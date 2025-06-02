# YouTubeShorts AI Generator 🎬

A powerful web application to automatically generate and upload engaging YouTube Shorts with AI-generated content, professional voiceovers, and beautiful visuals - all from a single prompt.

![YouTubeShorts AI Generator Banner](https://via.placeholder.com/1200x300/7f5af8/ffffff?text=YouTubeShorts+AI+Generator)

## ✨ Features

- **🤖 One-Prompt Video Creation** - Turn any idea into a complete video
- **📝 AI Script Generation** - Create engaging scripts with OpenAI GPT-4
- **💻 Code Snippet Visualization** - Beautiful code images with syntax highlighting
- **🔊 Professional TTS** - High-quality voice generation with multiple voices
- **📱 Vertical Video Format** - Perfect for YouTube Shorts
- **📤 Direct YouTube Upload** - Authenticate and upload videos to your channel
- **🔍 Stock Media** - Auto-selection of relevant background videos/images
- **📊 Batch Processing** - Create multiple videos from a list of prompts
- **💡 AI Prompt Suggestions** - Get trending content ideas for your niche

## 🚀 Quick Start

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/youtube-ai-video-automation.git
   cd youtube-shorts-ai-generator
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up your environment variables (create a `.env` file):

   ```
   OPENAI_API_KEY=your_openai_key
   PIXABAY_API_KEY=your_pixabay_key
   YOUTUBE_CLIENT_ID=your_youtube_client_id
   YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
   YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback
   SESSION_SECRET=your_secure_session_secret
   ```

4. Start the server:

   ```
   npm start
   ```

5. Open http://localhost:3000 in your browser

## 🔑 API Keys Required

- **OpenAI API**: [Get API Key](https://platform.openai.com/api-keys)
- **Pixabay API**: [Get API Key](https://pixabay.com/api/docs/)
- **YouTube API**:
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create a project and enable YouTube Data API v3
  3. Create OAuth 2.0 credentials
  4. Add authorized redirect URI: http://localhost:3000/auth/youtube/callback

## 📡 API Endpoints

### AI Video Generation

| Endpoint                           | Method | Description                                    |
| ---------------------------------- | ------ | ---------------------------------------------- |
| `/api/ai/create-video-from-prompt` | POST   | Generate a complete video from a single prompt |
| `/api/ai/create-videos-batch`      | POST   | Generate multiple videos from prompt array     |
| `/api/ai/suggest-prompts`          | GET    | Get AI-generated trending prompt ideas         |
| `/api/test-openai`                 | GET    | Test OpenAI connection                         |

### Standard Video Generation

| Endpoint              | Method | Description                                   |
| --------------------- | ------ | --------------------------------------------- |
| `/api/generate-video` | POST   | Standard video generation with manual content |
| `/api/search-media`   | GET    | Preview available stock videos/images         |
| `/api/preview-voice`  | POST   | Generate voice preview                        |

### YouTube Integration

| Endpoint                   | Method | Description                 |
| -------------------------- | ------ | --------------------------- |
| `/auth/youtube`            | GET    | Authenticate with YouTube   |
| `/api/youtube/auth-status` | GET    | Check authentication status |
| `/api/youtube/upload`      | POST   | Upload existing video file  |
| `/api/youtube/channel`     | GET    | Get channel information     |
| `/api/youtube/videos`      | GET    | Get your recent videos      |

## 💡 Example Prompts

- "Python trick to sort arrays in one line"
- "JavaScript async/await explained for beginners"
- "CSS flexbox vs grid comparison"
- "React hooks tutorial with examples"
- "SQL joins made simple"
- "Git commands every developer needs"
- "API design best practices"
- "Clean code principles in 60 seconds"

## 📺 Dashboard Features

- **🔄 Real-time Progress Monitoring** - Track your video generation progress
- **📊 YouTube Channel Statistics** - View your channel metrics
- **🎬 Recent Videos Listing** - Browse your uploaded videos
- **🧪 Connection Testing** - Verify API connections
- **⚙️ Video Creation Options** - Customize voice types, privacy settings, etc.

## 📋 Content Types

- **Tutorials** - Step-by-step educational content
- **Explanations** - Clear concept breakdowns
- **Tips** - Quick actionable advice
- **Comparisons** - Compare different options
- **Problem-Solutions** - Address common challenges

## 🛠️ Technologies Used

- **Backend**: Node.js, Express
- **AI**: OpenAI GPT-4
- **Video Processing**: FFmpeg
- **Web Scraping**: Puppeteer
- **Authentication**: OAuth2
- **APIs**: YouTube Data API v3, Pixabay API, Murf.ai

## 📸 Screenshots

![Dashboard](https://via.placeholder.com/800x400/242629/ffffff?text=Dashboard+View)
![Video+Creation](https://via.placeholder.com/800x400/242629/ffffff?text=Video+Creation)
![YouTube+Integration](https://via.placeholder.com/800x400/242629/ffffff?text=YouTube+Integration)

## ⚠️ Important Notes

- **API Key Security**: Keep your API keys secure and never commit them to public repositories
- **YouTube Quotas**: Be mindful of your YouTube API quota limits
- **OpenAI Usage**: Monitor your OpenAI API usage to manage costs

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check [issues page](https://github.com/yourusername/youtube-shorts-ai-generator/issues).

## 📄 License

This project is [MIT](LICENSE) licensed.

## 🙏 Acknowledgements

- [OpenAI](https://openai.com/) for the GPT-4 API
- [Pixabay](https://pixabay.com/) for stock videos and images
- [YouTube API](https://developers.google.com/youtube/v3) for YouTube integration
- [Murf.ai](https://murf.ai/) for text-to-speech capabilities
- [Ray.so](https://ray.so/) for code snippet styling
