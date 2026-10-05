import "./App.css";
import React, { useState, useEffect } from "react";

function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Zastąp swoim kluczem lub użyj zmiennej środowiskowej
  const API_KEY = process.env.API_KEY;
  const URL = `https://googleapis.com{API_KEY}`;

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(URL);
        if (!response.ok) {
          throw new Error("Problem z pobraniem danych z YouTube API");
        }
        const data = await response.json();
        setVideos(data.items); // Filmy znajdują się w tablicy 'items'
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [URL]);

  if (loading) return <p>Ładowanie filmów...</p>;
  if (error) return <p style={{ color: "red" }}>Błąd: {error}</p>;

  return (
    <div>
      <h2>Najpopularniejsze filmy na YouTube</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
        }}
      >
        {videos.map((video) => (
          <div
            key={video.id}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            <img
              src={video.snippet.thumbnails.medium.url}
              alt={video.snippet.title}
              style={{ width: "100%", borderRadius: "4px" }}
            />
            <h3 style={{ fontSize: "16px", margin: "10px 0 0 0" }}>
              {video.snippet.title}
            </h3>
            <p style={{ fontSize: "12px", color: "#555" }}>
              {video.snippet.channelTitle}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
