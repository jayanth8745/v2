# AI-Powered Personal Memory Assistant

A full-stack web application that allows users to create, manage, and retrieve personal memories using voice commands. The system features a Siri-like voice assistant that continuously listens for wake words and automatically processes speech to create intelligent memory entries.

## Features

### 🎤 Voice Assistant
- **Wake Word Detection**: Continuously listens for "Hey Memory" to activate
- **Speech-to-Text**: Converts voice input to text using Web Speech API
- **Natural Language Processing**: Automatically extracts title, mood, category, and tags from speech
- **Hands-Free Operation**: Create memories without typing

### 📝 Memory Management
- **Create Memories**: Add memories with text, images, dates, moods, and categories
- **Search & Filter**: Find memories by text, category, mood, or tags
- **Calendar View**: Visual memory timeline with daily memory counts
- **Image Upload**: Attach photos to memories for richer context

### 🎨 User Interface
- **Modern Design**: Clean, responsive interface with smooth animations
- **Dark Mode**: Toggle between light and dark themes
- **Mobile Responsive**: Works seamlessly on all devices
- **Real-time Updates**: Instant feedback and notifications

### 🔐 Security & Authentication
- **User Registration**: Secure account creation
- **JWT Authentication**: Token-based login system
- **Data Privacy**: User-specific memory isolation

## Tech Stack

### Backend
- **Python 3.8+**
- **Flask**: Web framework
- **MongoDB**: NoSQL database
- **JWT**: Authentication tokens
- **Werkzeug**: Security utilities
- **Pillow**: Image processing

### Frontend
- **HTML5, CSS3, JavaScript (ES6+)**
- **Web Speech API**: Voice recognition
- **Font Awesome**: Icons
- **CSS Grid & Flexbox**: Responsive layout
- **CSS Variables**: Theme management

## Installation

### Prerequisites
- Python 3.8 or higher
- MongoDB running locally or MongoDB Atlas account
- Modern web browser with Web Speech API support

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd memory-assistant
   ```

2. **Set up Python environment**
   ```bash
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   # Copy .env.example to .env
   cp .env.example .env
   
   # Edit .env with your configuration
   JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
   MONGO_URI=mongodb://localhost:27017/
   ```

5. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

6. **Run the backend server**
   ```bash
   cd backend
   python app.py
   ```

7. **Open the frontend**
   - Open `frontend/index.html` in your web browser
   - Or serve with a local server:
     ```bash
     cd frontend
     python -m http.server 3000
     ```

## Usage

### Getting Started

1. **Create an Account**
   - Register with your email and password
   - Or login if you already have an account

2. **Create Your First Memory**
   - Use the manual form to add memories with text, images, and metadata
   - Or use voice commands for hands-free creation

3. **Voice Commands**
   - Click the microphone button or say "Hey Memory"
   - Speak naturally: "Hey Memory, I had a great day at work today, finished the project ahead of deadline"
   - The system will automatically extract mood (happy), category (work), and create the memory

### Voice Assistant Features

- **Wake Word**: "Hey Memory" activates the assistant
- **Auto-stop**: Automatically stops after 10 seconds of inactivity
- **Manual Control**: Click the microphone button to toggle
- **Real-time Feedback**: See your speech transcribed as you speak

### Memory Organization

- **Categories**: Work, Family, Friends, Travel, Food, Health, Education, Hobby, General
- **Moods**: Happy, Sad, Angry, Excited, Peaceful, Love, Neutral
- **Tags**: Add custom tags for better organization
- **Dates**: Set specific dates or use current date

### Search and Discovery

- **Text Search**: Find memories by content
- **Filter by Category**: View memories from specific life areas
- **Filter by Mood**: Track emotional patterns
- **Calendar View**: See memories organized by date

## API Endpoints

### Authentication
- `POST /api/register` - Create new user account
- `POST /api/login` - User login

### Memories
- `GET /api/memories` - Get user memories (with pagination, search, filters)
- `POST /api/memories` - Create new memory
- `GET /api/memories/{id}` - Get specific memory
- `PUT /api/memories/{id}` - Update memory
- `DELETE /api/memories/{id}` - Delete memory
- `POST /api/voice-memory` - Create memory from voice input

### Files
- `POST /api/upload` - Upload image file

### Stats
- `GET /api/stats` - Get user statistics

## Natural Language Processing

The voice assistant uses basic NLP techniques to extract memory details:

### Mood Detection
- **Happy**: "happy", "joy", "excited", "wonderful", "amazing", "great", "fantastic"
- **Sad**: "sad", "depressed", "unhappy", "terrible", "awful", "bad"
- **Angry**: "angry", "mad", "furious", "annoyed", "frustrated"
- **Excited**: "excited", "thrilled", "enthusiastic"
- **Peaceful**: "peaceful", "calm", "relaxed", "serene"
- **Love**: "love", "loved", "adore", "cherish"

### Category Detection
- **Work**: "work", "job", "office", "meeting", "project", "deadline"
- **Family**: "family", "mom", "dad", "brother", "sister", "parents"
- **Friends**: "friend", "friends", "buddy", "pal"
- **Travel**: "travel", "trip", "vacation", "holiday", "journey"
- **Food**: "food", "eat", "dinner", "lunch", "breakfast", "restaurant"
- **Health**: "health", "doctor", "hospital", "exercise", "gym"
- **Education**: "school", "study", "learn", "class", "exam"
- **Hobby**: "hobby", "game", "play", "music", "movie", "book"

### Tag Extraction
Common keywords like "important", "urgent", "remember", "birthday", "anniversary", "meeting", "appointment" are automatically extracted as tags.

## File Structure

```
memory-assistant/
├── backend/
│   └── app.py                 # Flask application
├── frontend/
│   ├── index.html            # Main HTML file
│   ├── styles.css            # CSS styles
│   └── script.js             # JavaScript functionality
├── uploads/                  # Uploaded images
├── static/
│   └── images/              # Static images
├── requirements.txt          # Python dependencies
├── .env.example             # Environment variables template
└── README.md               # This file
```

## Browser Compatibility

The voice assistant requires Web Speech API support, which is available in:
- Chrome/Edge (full support)
- Safari (partial support)
- Firefox (limited support)

For best results, use Chrome or Edge browsers.

## Security Considerations

- **JWT Secret Key**: Change the default JWT secret key in production
- **HTTPS**: Use HTTPS in production for secure communication
- **Input Validation**: All user inputs are validated on the backend
- **File Upload**: Image uploads are restricted to specific file types
- **Database Security**: User data is isolated by user ID

## Future Enhancements

- **Advanced NLP**: Integration with more sophisticated NLP services
- **Mobile App**: Native mobile applications
- **Export Features**: PDF, JSON, or calendar exports
- **Reminders**: Memory-based notifications and reminders
- **Social Features**: Share memories with trusted contacts
- **AI Insights**: Pattern analysis and emotional trends
- **Backup/Restore**: Cloud backup and restore functionality

## Troubleshooting

### Voice Recognition Issues
- Ensure microphone permissions are granted
- Use a supported browser (Chrome/Edge recommended)
- Check microphone hardware and drivers
- Speak clearly and reduce background noise

### Database Connection Issues
- Verify MongoDB is running
- Check connection string in .env file
- Ensure network connectivity to MongoDB

### Image Upload Issues
- Verify uploads folder exists and is writable
- Check file size limits
- Ensure supported image formats (PNG, JPG, JPEG, GIF)

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
#   v 2  
 