import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

export default function PushupCounter() {
  const [counter, setCounter] = useState(0);
  const [stage, setStage] = useState('waiting');
  const [isCounting, setIsCounting] = useState(false);
  const [workoutId, setWorkoutId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  // Load workout history
  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        const response = await fetch('/api/workouts');
        const data = await response.json();
        setWorkouts(data);
      } catch (error) {
        console.error('Error loading workouts:', error);
      }
    };
    loadWorkouts();
  }, []);

  // Start the camera and detection
  const startCamera = async () => {
    try {
      // Start a new workout session
      const workoutResponse = await fetch('/api/start_workout', {
        method: 'POST',
      });
      const { workout_id } = await workoutResponse.json();
      setWorkoutId(workout_id);
      
      // Start the camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCounting(true);
        processFrame();
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      alert('Failed to start camera. Please ensure you have granted camera permissions.');
    }
  };

  // Process each frame
  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isCounting) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to base64
    const imageData = canvas.toDataURL('image/jpeg');
    
    try {
      // Send frame to the server for processing
      const response = await fetch('/api/process_frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_data: imageData,
          timestamp: new Date().toISOString(),
        }),
      });
      
      const data = await response.json();
      
      if (data.counter !== undefined) {
        setCounter(data.counter);
      }
      
      if (data.stage) {
        setStage(data.stage);
      }
      
    } catch (error) {
      console.error('Error processing frame:', error);
    }
    
    // Continue processing frames
    animationRef.current = requestAnimationFrame(processFrame);
  };

  // Stop the camera and detection
  const stopCamera = async () => {
    setIsCounting(false);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // End the workout session
    if (workoutId) {
      try {
        await fetch(`/api/end_workout/${workoutId}`, {
          method: 'POST',
        });
        // Refresh workout history
        const response = await fetch('/api/workouts');
        const data = await response.json();
        setWorkouts(data);
      } catch (error) {
        console.error('Error ending workout:', error);
      }
    }
  };

  // Toggle workout history
  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Pushup Counter</title>
        <meta name="description" content="AI-powered pushup counter using computer vision" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700">Pushup Counter</h1>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Camera Feed */}
          <div className="w-full md:w-2/3 bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ display: isCounting ? 'block' : 'none' }}
              />
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
                style={{ display: 'none' }}
              />
              {!isCounting && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <p className="text-xl">Camera feed will appear here when started</p>
                </div>
              )}
            </div>
            
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Pushups</p>
                  <p className="text-4xl font-bold">{counter}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-xl font-semibold capitalize">{stage}</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                {!isCounting ? (
                  <button
                    onClick={startCamera}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                  >
                    Start Workout
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                  >
                    Stop Workout
                  </button>
                )}
                <button
                  onClick={toggleHistory}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  {showHistory ? 'Hide History' : 'Show History'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Workout History */}
          <div className={`w-full md:w-1/3 bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${showHistory ? 'block' : 'hidden md:block'}`}>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Workout History</h2>
              {workouts.length === 0 ? (
                <p className="text-gray-500">No workout history yet. Complete a workout to see your progress!</p>
              ) : (
                <div className="space-y-4">
                  {workouts.map((workout) => (
                    <div key={workout._id} className="border-b pb-4 mb-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">
                            {new Date(workout.start_time).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(workout.start_time).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-indigo-600">
                            {workout.total_pushups}
                          </p>
                          <p className="text-sm text-gray-500">pushups</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">How It Works</h2>
          <ol className="list-decimal pl-5 space-y-2 text-gray-700">
            <li>Click "Start Workout" to begin your pushup session</li>
            <li>Position yourself in the camera frame</li>
            <li>Perform pushups - the counter will track each rep</li>
            <li>Click "Stop Workout" when you're finished</li>
            <li>View your workout history to track your progress over time</li>
          </ol>
          
          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <p className="text-yellow-700">
              <strong>Tip:</strong> For best results, ensure good lighting and position your full body in the frame.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-12 py-6 border-t border-gray-200">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>Pushup Counter &copy; {new Date().getFullYear()} - Built with Next.js and MediaPipe</p>
        </div>
      </footer>
    </div>
  );
}
