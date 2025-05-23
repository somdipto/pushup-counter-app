# Pushup Counter

An AI-powered pushup counter that uses computer vision to track and count your pushups in real-time.

## Features

- Real-time pushup counting using MediaPipe
- Workout history tracking
- Responsive web interface
- Serverless backend with Vercel
- MongoDB for data storage

## Prerequisites

- Node.js (v14+)
- Python (3.8+)
- MongoDB Atlas account (for cloud database)
- Vercel account (for deployment)

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install Node.js dependencies
   npm install
   
   # Install Python dependencies
   pip install -r requirements.txt
   ```
3. Create a `.env.local` file in the root directory with your MongoDB connection string:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment to Vercel

1. Push your code to a GitHub, GitLab, or Bitbucket repository
2. Import the repository to Vercel
3. Add your MongoDB connection string as an environment variable:
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add a new variable:
     - Name: `MONGODB_URI`
     - Value: `your_mongodb_connection_string`
4. Deploy your application

## How It Works

1. The frontend captures video from your webcam using the browser's MediaDevices API
2. Frames are sent to the backend for processing
3. The backend uses MediaPipe to detect body landmarks
4. Pushups are counted based on the angle of the elbows
5. Workout data is stored in MongoDB

## Technologies Used

- Frontend: Next.js, React, Tailwind CSS
- Backend: FastAPI, Python
- Computer Vision: MediaPipe, OpenCV
- Database: MongoDB Atlas
- Hosting: Vercel

## License

MIT
