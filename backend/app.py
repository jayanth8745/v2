from flask import Flask, request, jsonify
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import uuid
from bson.objectid import ObjectId
import json

load_dotenv()

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-here')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
jwt = JWTManager(app)

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')

CORS(app, origins=['http://localhost:8000', 'http://127.0.0.1:8000'],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'])

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client['memory_assistant']
users_collection = db['users']
memories_collection = db['memories']

# Create text index for search
memories_collection.create_index([("title", "text"), ("description", "text"), ("tags", "text")])

# Upload folder
UPLOAD_FOLDER = '../uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Check if user already exists
        existing_user = users_collection.find_one({'email': data['email']})
        if existing_user:
            return jsonify({'error': 'User already exists'}), 400
        
        # Create new user
        hashed_password = generate_password_hash(data['password'])
        user = {
            'email': data['email'],
            'password': hashed_password,
            'name': data.get('name', ''),
            'created_at': datetime.utcnow()
        }
        
        result = users_collection.insert_one(user)
        access_token = create_access_token(identity=str(result.inserted_id))
        
        return jsonify({
            'message': 'User registered successfully',
            'access_token': access_token,
            'user': {
                'id': str(result.inserted_id),
                'email': data['email'],
                'name': data.get('name', ''),
                'picture': ''
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        user = users_collection.find_one({'email': data['email']})
        
        if not user or not check_password_hash(user['password'], data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        access_token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'name': user.get('name', ''),
                'picture': user.get('picture', '')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    """Verify Google ID token and create/login user"""
    try:
        data = request.get_json()
        credential = data.get('credential')
        
        if not credential:
            return jsonify({'error': 'Google credential is required'}), 400
        
        if not GOOGLE_CLIENT_ID:
            return jsonify({'error': 'Google authentication is not configured on the server'}), 500
        
        # Verify the Google ID token
        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )
        except ValueError as e:
            return jsonify({'error': 'Invalid Google token: ' + str(e)}), 401
        
        # Extract user info from the verified token
        google_id = idinfo.get('sub')
        email = idinfo.get('email')
        name = idinfo.get('name', '')
        picture = idinfo.get('picture', '')
        email_verified = idinfo.get('email_verified', False)
        
        if not email:
            return jsonify({'error': 'Email not available from Google account'}), 400
        
        if not email_verified:
            return jsonify({'error': 'Google email is not verified'}), 400
        
        # Check if user already exists (by email or google_id)
        existing_user = users_collection.find_one({
            '$or': [
                {'email': email},
                {'google_id': google_id}
            ]
        })
        
        if existing_user:
            # Update existing user with Google info
            users_collection.update_one(
                {'_id': existing_user['_id']},
                {'$set': {
                    'google_id': google_id,
                    'picture': picture,
                    'name': name if not existing_user.get('name') else existing_user['name'],
                    'updated_at': datetime.utcnow()
                }}
            )
            user_id = str(existing_user['_id'])
            user_name = existing_user.get('name') or name
        else:
            # Create new user
            new_user = {
                'email': email,
                'name': name,
                'picture': picture,
                'google_id': google_id,
                'auth_provider': 'google',
                'created_at': datetime.utcnow()
            }
            result = users_collection.insert_one(new_user)
            user_id = str(result.inserted_id)
            user_name = name
        
        # Generate JWT token
        access_token = create_access_token(identity=user_id)
        
        return jsonify({
            'message': 'Google authentication successful',
            'access_token': access_token,
            'user': {
                'id': user_id,
                'email': email,
                'name': user_name,
                'picture': picture
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Authentication failed: ' + str(e)}), 500

@app.route('/api/memories', methods=['POST'])
@jwt_required()
def create_memory():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        memory = {
            'user_id': user_id,
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'mood': data.get('mood', 'neutral'),
            'category': data.get('category', 'general'),
            'tags': data.get('tags', []),
            'date': data.get('date', datetime.utcnow().isoformat()),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = memories_collection.insert_one(memory)
        memory['_id'] = str(result.inserted_id)
        
        return jsonify({
            'message': 'Memory created successfully',
            'memory': memory
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/memories', methods=['GET'])
@jwt_required()
def get_memories():
    try:
        user_id = get_jwt_identity()
        
        # Query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        category = request.args.get('category')
        mood = request.args.get('mood')
        search = request.args.get('search')
        
        # Build filter
        filter_query = {'user_id': user_id}
        
        if category:
            filter_query['category'] = category
        if mood:
            filter_query['mood'] = mood
        if search:
            filter_query['$text'] = {'$search': search}
        
        # Get memories with pagination
        skip = (page - 1) * limit
        memories = list(memories_collection.find(filter_query)
                       .sort('created_at', -1)
                       .skip(skip)
                       .limit(limit))
        
        # Convert ObjectId to string
        for memory in memories:
            memory['_id'] = str(memory['_id'])
            memory['id'] = memory['_id']
        
        total = memories_collection.count_documents(filter_query)
        
        return jsonify({
            'memories': memories,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/memories/<memory_id>', methods=['GET'])
@jwt_required()
def get_memory(memory_id):
    try:
        user_id = get_jwt_identity()
        
        memory = memories_collection.find_one({
            '_id': ObjectId(memory_id),
            'user_id': user_id
        })
        
        if not memory:
            return jsonify({'error': 'Memory not found'}), 404
        
        memory['_id'] = str(memory['_id'])
        memory['id'] = memory['_id']
        
        return jsonify({'memory': memory}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/memories/<memory_id>', methods=['PUT'])
@jwt_required()
def update_memory(memory_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        update_data = {
            'title': data.get('title'),
            'description': data.get('description'),
            'mood': data.get('mood'),
            'category': data.get('category'),
            'tags': data.get('tags'),
            'updated_at': datetime.utcnow()
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = memories_collection.update_one(
            {'_id': ObjectId(memory_id), 'user_id': user_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Memory not found'}), 404
        
        return jsonify({'message': 'Memory updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/memories/<memory_id>', methods=['DELETE'])
@jwt_required()
def delete_memory(memory_id):
    try:
        user_id = get_jwt_identity()
        
        result = memories_collection.delete_one({
            '_id': ObjectId(memory_id),
            'user_id': user_id
        })
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Memory not found'}), 404
        
        return jsonify({'message': 'Memory deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
@jwt_required()
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            filename = str(uuid.uuid4()) + '.' + file.filename.rsplit('.', 1)[1].lower()
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            return jsonify({
                'message': 'File uploaded successfully',
                'filename': filename,
                'file_url': f'/uploads/{filename}'
            }), 200
        else:
            return jsonify({'error': 'File type not allowed'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/voice-memory', methods=['POST'])
@jwt_required()
def create_voice_memory():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Process voice text to extract memory details
        voice_text = data.get('text', '')
        processed_memory = process_voice_text(voice_text)
        
        memory = {
            'user_id': user_id,
            'title': processed_memory.get('title', 'Voice Memory'),
            'description': processed_memory.get('description', voice_text),
            'mood': processed_memory.get('mood', 'neutral'),
            'category': processed_memory.get('category', 'general'),
            'tags': processed_memory.get('tags', []),
            'date': processed_memory.get('date', datetime.utcnow().isoformat()),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'voice_text': voice_text
        }
        
        result = memories_collection.insert_one(memory)
        memory['_id'] = str(result.inserted_id)
        
        return jsonify({
            'message': 'Voice memory created successfully',
            'memory': memory
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def process_voice_text(text):
    """Simple NLP processing to extract memory details from voice text"""
    import re
    
    # Initialize default values
    processed = {
        'title': 'Voice Memory',
        'description': text,
        'mood': 'neutral',
        'category': 'general',
        'tags': []
    }
    
    text_lower = text.lower()
    
    # Extract mood
    mood_keywords = {
        'happy': ['happy', 'joy', 'excited', 'wonderful', 'amazing', 'great', 'fantastic'],
        'sad': ['sad', 'depressed', 'unhappy', 'terrible', 'awful', 'bad'],
        'angry': ['angry', 'mad', 'furious', 'annoyed', 'frustrated'],
        'excited': ['excited', 'thrilled', 'enthusiastic'],
        'peaceful': ['peaceful', 'calm', 'relaxed', 'serene'],
        'love': ['love', 'loved', 'adore', 'cherish']
    }
    
    for mood, keywords in mood_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            processed['mood'] = mood
            break
    
    # Extract category
    category_keywords = {
        'work': ['work', 'job', 'office', 'meeting', 'project', 'deadline'],
        'family': ['family', 'mom', 'dad', 'brother', 'sister', 'parents'],
        'friends': ['friend', 'friends', 'buddy', 'pal'],
        'travel': ['travel', 'trip', 'vacation', 'holiday', 'journey'],
        'food': ['food', 'eat', 'dinner', 'lunch', 'breakfast', 'restaurant'],
        'health': ['health', 'doctor', 'hospital', 'exercise', 'gym'],
        'education': ['school', 'study', 'learn', 'class', 'exam'],
        'hobby': ['hobby', 'game', 'play', 'music', 'movie', 'book']
    }
    
    for category, keywords in category_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            processed['category'] = category
            break
    
    # Extract title (first sentence or up to 50 characters)
    sentences = re.split(r'[.!?]+', text)
    if sentences and len(sentences[0].strip()) > 0:
        title_candidate = sentences[0].strip()
        if len(title_candidate) > 50:
            title_candidate = title_candidate[:47] + '...'
        processed['title'] = title_candidate
    
    # Extract potential tags (common words)
    common_words = ['important', 'urgent', 'remember', 'birthday', 'anniversary', 'meeting', 'appointment']
    tags = [word for word in common_words if word in text_lower]
    processed['tags'] = tags
    
    return processed

@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    try:
        user_id = get_jwt_identity()
        
        # Get memory statistics
        total_memories = memories_collection.count_documents({'user_id': user_id})
        
        # Get memories by category
        pipeline = [
            {'$match': {'user_id': user_id}},
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        categories = list(memories_collection.aggregate(pipeline))
        
        # Get memories by mood
        pipeline = [
            {'$match': {'user_id': user_id}},
            {'$group': {'_id': '$mood', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        moods = list(memories_collection.aggregate(pipeline))
        
        return jsonify({
            'total_memories': total_memories,
            'categories': categories,
            'moods': moods
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/query', methods=['POST'])
@jwt_required()
def query_memories():
    try:
        data = request.get_json()
        query = data.get('query', '').lower()
        user_id = get_jwt_identity()
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Parse the query to understand what user wants
        query_type, filters, response_text = parse_natural_language_query(query, user_id)
        
        # Build MongoDB query based on parsed intent
        mongo_query = {'user_id': user_id}
        
        # Apply filters based on query analysis
        if query_type == 'date_range':
            if 'start_date' in filters:
                mongo_query['date'] = {'$gte': filters['start_date']}
            if 'end_date' in filters:
                mongo_query['date'] = mongo_query.get('date', {})
                mongo_query['date']['$lte'] = filters['end_date']
                
        elif query_type == 'mood':
            mongo_query['mood'] = filters.get('mood', 'neutral')
            
        elif query_type == 'category':
            mongo_query['category'] = filters.get('category', 'general')
            
        elif query_type == 'search':
            mongo_query['$text'] = {'$search': query}
        
        # Execute the query
        memories = list(memories_collection.find(mongo_query)
                                   .sort('created_at', -1)
                                   .limit(10))
        
        # Convert ObjectId to string
        for memory in memories:
            memory['_id'] = str(memory['_id'])
            memory['id'] = memory['_id']
        
        return jsonify({
            'response': response_text,
            'memories': memories,
            'query_type': query_type,
            'filters': filters
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def parse_natural_language_query(query, user_id):
    """Parse natural language query to extract intent and filters"""
    import re
    from datetime import datetime, timedelta
    
    # Initialize defaults
    query_type = 'search'
    filters = {}
    response_text = "I found some memories for you."
    
    # Date-based queries
    if any(phrase in query for phrase in [
        'last week', 'past week', 'this week', 'recent week'
    ]):
        query_type = 'date_range'
        start_date = datetime.utcnow() - timedelta(days=7)
        filters['start_date'] = start_date
        response_text = "Here are your memories from the last week."
        
    elif any(phrase in query for phrase in [
        'last month', 'past month', 'this month', 'recent month'
    ]):
        query_type = 'date_range'
        start_date = datetime.utcnow() - timedelta(days=30)
        filters['start_date'] = start_date
        response_text = "Here are your memories from the last month."
        
    elif any(phrase in query for phrase in [
        'yesterday', 'yesterday'
    ]):
        query_type = 'date_range'
        start_date = datetime.utcnow() - timedelta(days=1)
        filters['start_date'] = start_date
        filters['end_date'] = datetime.utcnow()
        response_text = "Here are your memories from yesterday."
        
    elif any(phrase in query for phrase in [
        'today', 'today'
    ]):
        query_type = 'date_range'
        start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        filters['start_date'] = start_date
        response_text = "Here are your memories from today."
    
    # Mood-based queries
    elif any(phrase in query for phrase in [
        'happy memories', 'happy', 'good memories', 'positive memories'
    ]):
        query_type = 'mood'
        filters['mood'] = 'happy'
        response_text = "Here are your happy memories."
        
    elif any(phrase in query for phrase in [
        'sad memories', 'sad', 'unhappy memories'
    ]):
        query_type = 'mood'
        filters['mood'] = 'sad'
        response_text = "Here are your sad memories."
        
    elif any(phrase in query for phrase in [
        'angry memories', 'angry', 'mad memories'
    ]):
        query_type = 'mood'
        filters['mood'] = 'angry'
        response_text = "Here are your angry memories."
        
    elif any(phrase in query for phrase in [
        'excited memories', 'excited', 'thrilled memories'
    ]):
        query_type = 'mood'
        filters['mood'] = 'excited'
        response_text = "Here are your excited memories."
    
    # Category-based queries
    elif any(phrase in query for phrase in [
        'work memories', 'work', 'job', 'office', 'meeting', 'project'
    ]):
        query_type = 'category'
        filters['category'] = 'work'
        response_text = "Here are your work-related memories."
        
    elif any(phrase in query for phrase in [
        'family memories', 'family', 'mom', 'dad', 'brother', 'sister'
    ]):
        query_type = 'category'
        filters['category'] = 'family'
        response_text = "Here are your family memories."
        
    elif any(phrase in query for phrase in [
        'travel memories', 'travel', 'trip', 'vacation', 'holiday'
    ]):
        query_type = 'category'
        filters['category'] = 'travel'
        response_text = "Here are your travel memories."
        
    elif any(phrase in query for phrase in [
        'food memories', 'food', 'dinner', 'lunch', 'breakfast', 'restaurant'
    ]):
        query_type = 'category'
        filters['category'] = 'food'
        response_text = "Here are your food-related memories."
    
    # Count queries
    elif any(phrase in query for phrase in [
        'how many', 'count', 'total', 'number of'
    ]):
        response_text = f"You have {memories_collection.count_documents({'user_id': user_id})} total memories."
    
    return query_type, filters, response_text

if __name__ == '__main__':
    app.run(debug=True, port=5000)
