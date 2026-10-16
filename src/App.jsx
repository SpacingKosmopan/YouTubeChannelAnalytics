import "./App.css";
import { useEffect, useMemo, useState } from "react";

const API_KEY = import.meta.env.VITE_API_KEY;
const CHANNEL_HANDLE = "@Spacing_Gaming";
const HASHTAG = "#bulletechoshorts";

// Zmieniasz tylko te dwie daty, aby wybrać inny miesiąc.
const START_DATE = new Date("2026-10-01T00:00:00Z");
const END_DATE = new Date("2026-11-01T00:00:00Z");

const MONTH_LABEL = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(START_DATE);

const numberFormat = new Intl.NumberFormat("pl-PL");

const formatNumber = (value) => numberFormat.format(value);

const formatDate = (date) =>
  new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

function StatCard({ label, value, detail }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
      {detail && <p className="stat-detail">{detail}</p>}
    </article>
  );
}

function DailyChart({ days, valueKey, title, color, formatValue }) {
  const maxValue = Math.max(1, ...days.map((day) => day[valueKey]));

  const total = days.reduce((sum, day) => sum + day[valueKey], 0);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            Łącznie: <strong>{formatValue(total)}</strong>
          </p>
        </div>
      </div>

      <div
        className="chart"
        role="img"
        aria-label={`${title}. Wartości dla kolejnych dni miesiąca.`}
      >
        {days.map((day) => {
          const height = (day[valueKey] / maxValue) * 100;

          return (
            <div
              className="chart-column"
              key={day.date}
              title={`${day.date}: ${formatValue(day[valueKey])}`}
            >
              <span className="chart-value">
                {day[valueKey] > 0 ? formatValue(day[valueKey]) : ""}
              </span>

              <div className="chart-bar-area">
                <div
                  className="chart-bar"
                  style={{
                    height: `${height}%`,
                    backgroundColor: color,
                    minHeight: day[valueKey] > 0 ? "3px" : "0",
                  }}
                />
              </div>

              <span className="chart-label">
                {day.day % 5 === 1 || day.day === days.length ? day.day : ""}
              </span>
            </div>
          );
        })}
      </div>

      <p className="chart-footnote">
        {valueKey === "views"
          ? "Suma aktualnych wyświetleń Shortów opublikowanych danego dnia."
          : "Liczba Shortów opublikowanych danego dnia."}
      </p>
    </section>
  );
}

function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [sortBy, setSortBy] = useState("views");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError("");

        if (!API_KEY) {
          throw new Error(
            "Brak VITE_API_KEY. Sprawdź plik .env i uruchom ponownie Vite.",
          );
        }

        async function fetchJson(url) {
          const response = await fetch(url);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error?.message ||
                `YouTube API zwróciło błąd ${response.status}`,
            );
          }

          return data;
        }

        setProgress("Pobieram informacje o kanale...");

        const channelParams = new URLSearchParams({
          part: "contentDetails",
          forHandle: CHANNEL_HANDLE,
          key: API_KEY,
        });

        const channelData = await fetchJson(
          `https://www.googleapis.com/youtube/v3/channels?${channelParams}`,
        );

        const channel = channelData.items?.[0];

        if (!channel) {
          throw new Error(`Nie znaleziono kanału ${CHANNEL_HANDLE}.`);
        }

        const playlistId = channel.contentDetails.relatedPlaylists.uploads;

        const playlistItems = [];
        let nextPageToken = "";

        // Pobieramy najnowsze filmy. Lista uploadów jest
        // uporządkowana od najnowszych do najstarszych.
        while (true) {
          const params = new URLSearchParams({
            part: "snippet,contentDetails",
            playlistId,
            maxResults: "50",
            key: API_KEY,
          });

          if (nextPageToken) {
            params.set("pageToken", nextPageToken);
          }

          setProgress(
            `Pobieram filmy z kanału (${playlistItems.length} sprawdzonych)...`,
          );

          const data = await fetchJson(
            `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
          );

          const items = data.items || [];
          let reachedOlderVideos = false;

          for (const item of items) {
            const publishedAt = new Date(
              item.contentDetails?.videoPublishedAt || item.snippet.publishedAt,
            );

            if (publishedAt < START_DATE) {
              reachedOlderVideos = true;
              break;
            }

            if (
              publishedAt >= START_DATE &&
              publishedAt < END_DATE &&
              item.contentDetails?.videoId
            ) {
              playlistItems.push(item);
            }
          }

          if (reachedOlderVideos || !data.nextPageToken) {
            break;
          }

          nextPageToken = data.nextPageToken;
        }

        const ids = [
          ...new Set(
            playlistItems
              .map((item) => item.contentDetails.videoId)
              .filter(Boolean),
          ),
        ];

        const details = [];

        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i, i + 50);

          setProgress(
            `Pobieram statystyki (${Math.min(i + 50, ids.length)}/${ids.length})...`,
          );

          const params = new URLSearchParams({
            part: "snippet,statistics",
            id: batch.join(","),
            key: API_KEY,
          });

          const data = await fetchJson(
            `https://www.googleapis.com/youtube/v3/videos?${params}`,
          );

          details.push(...(data.items || []));
        }

        const matchingVideos = details.filter((video) => {
          const publishedAt = new Date(video.snippet.publishedAt);

          // Weryfikujemy prawdziwą datę publikacji filmu.
          if (publishedAt < START_DATE || publishedAt >= END_DATE) {
            return false;
          }

          const text = [video.snippet.title, video.snippet.description]
            .join(" ")
            .toLowerCase();

          return text.includes(HASHTAG);
        });

        if (!cancelled) {
          setVideos(matchingVideos);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Wystąpił nieznany błąd.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setProgress("");
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const totalViews = videos.reduce(
      (sum, video) => sum + Number(video.statistics?.viewCount || 0),
      0,
    );

    const count = videos.length;
    const averageViews = count ? totalViews / count : 0;

    const sortedViews = videos
      .map((video) => Number(video.statistics?.viewCount || 0))
      .sort((a, b) => a - b);

    const middle = Math.floor(sortedViews.length / 2);

    const medianViews = !count
      ? 0
      : count % 2
        ? sortedViews[middle]
        : (sortedViews[middle - 1] + sortedViews[middle]) / 2;

    const daysInMonth = Math.round((END_DATE - START_DATE) / 86400000);

    const dailyStats = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(START_DATE.getTime() + index * 86400000);

      const dateKey = date.toISOString().slice(0, 10);

      return {
        date: dateKey,
        day: index + 1,
        views: 0,
        count: 0,
      };
    });

    const daysByDate = new Map(dailyStats.map((day) => [day.date, day]));

    for (const video of videos) {
      const dateKey = new Date(video.snippet.publishedAt)
        .toISOString()
        .slice(0, 10);

      const day = daysByDate.get(dateKey);

      if (day) {
        day.views += Number(video.statistics?.viewCount || 0);
        day.count += 1;
      }
    }

    const publishedDays = dailyStats.filter((day) => day.count > 0).length;

    const bestVideo = [...videos].sort(
      (a, b) =>
        Number(b.statistics?.viewCount || 0) -
        Number(a.statistics?.viewCount || 0),
    )[0];

    return {
      totalViews,
      count,
      averageViews,
      medianViews,
      dailyStats,
      publishedDays,
      averagePerPublishedDay: publishedDays ? count / publishedDays : 0,
      bestVideo,
    };
  }, [videos]);

  const sortedVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt)
        );
      }

      if (sortBy === "title") {
        return a.snippet.title.localeCompare(b.snippet.title, "pl");
      }

      return (
        Number(b.statistics?.viewCount || 0) -
        Number(a.statistics?.viewCount || 0)
      );
    });
  }, [videos, sortBy]);

  if (loading) {
    return (
      <main className="app">
        <div className="loading-card">
          <div className="spinner" />
          <h2>Analizuję kanał YouTube</h2>
          <p>{progress}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app">
        <div className="error-card">
          <h2>Nie udało się pobrać danych</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Spróbuj ponownie
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="page-header">
        <div>
          <p className="eyebrow">YOUTUBE ANALYTICS</p>
          <h1>Shorts Dashboard</h1>
          <p className="muted">
            {CHANNEL_HANDLE} · {HASHTAG}
          </p>
        </div>

        <div className="month-badge">{MONTH_LABEL}</div>
      </header>

      <section className="stats-grid">
        <StatCard
          label="Łączne wyświetlenia"
          value={formatNumber(stats.totalViews)}
          detail="Wyświetlenia wszystkich znalezionych Shortów"
        />

        <StatCard
          label="Liczba Shortów"
          value={formatNumber(stats.count)}
          detail="Filmy zawierające szukany hashtag"
        />

        <StatCard
          label="Średnio na Short"
          value={formatNumber(Math.round(stats.averageViews))}
          detail="Łączne wyświetlenia / liczba Shortów"
        />

        <StatCard
          label="Mediana wyświetleń"
          value={formatNumber(Math.round(stats.medianViews))}
          detail="Odporniejsza na pojedyncze viralowe filmy"
        />

        <StatCard
          label="Publikacje dziennie"
          value={stats.averagePerPublishedDay.toLocaleString("pl-PL", {
            maximumFractionDigits: 2,
          })}
          detail={`Średnia w ${stats.publishedDays} dniach z publikacją`}
        />

        <StatCard
          label="Najlepszy Short"
          value={formatNumber(
            Number(stats.bestVideo?.statistics?.viewCount || 0),
          )}
          detail={stats.bestVideo?.snippet.title || "Brak danych"}
        />
      </section>

      <div className="charts-grid">
        <DailyChart
          days={stats.dailyStats}
          valueKey="views"
          title="Wyświetlenia według dnia publikacji"
          color="#8b5cf6"
          formatValue={formatNumber}
        />

        <DailyChart
          days={stats.dailyStats}
          valueKey="count"
          title="Liczba publikacji dziennie"
          color="#22c55e"
          formatValue={formatNumber}
        />
      </div>

      <section className="videos-section">
        <div className="section-heading">
          <div>
            <h2>Twoje Shortsy</h2>
            <p className="muted">Znaleziono: {stats.count} filmów</p>
          </div>

          <label className="sort-control">
            Sortuj:
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="views">Najwięcej wyświetleń</option>
              <option value="date">Najnowsze</option>
              <option value="title">Alfabetycznie</option>
            </select>
          </label>
        </div>

        {sortedVideos.length === 0 ? (
          <div className="empty-state">
            <h3>Brak Shortów w tym miesiącu</h3>
            <p>Nie znaleziono filmów z hashtagiem {HASHTAG}.</p>
          </div>
        ) : (
          <div className="videos-grid">
            {sortedVideos.map((video) => {
              const views = Number(video.statistics?.viewCount || 0);

              return (
                <a
                  className="video-card"
                  key={video.id}
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="thumbnail-wrapper">
                    <img
                      src={
                        video.snippet.thumbnails.maxres?.url ||
                        video.snippet.thumbnails.high?.url ||
                        video.snippet.thumbnails.medium?.url
                      }
                      alt=""
                      loading="lazy"
                    />
                    <span className="views-badge">
                      {formatNumber(views)} wyświetleń
                    </span>
                  </div>

                  <div className="video-info">
                    <h3>{video.snippet.title}</h3>
                    <p>{formatDate(new Date(video.snippet.publishedAt))}</p>
                    <div className="video-footer">
                      <span>Otwórz na YouTube</span>
                      <span aria-hidden="true">↗</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <footer className="page-footer">
        Dane pobrane z YouTube Data API v3. Wyświetlenia przedstawiają aktualny
        stan licznika, a nie historyczny przyrost z dnia publikacji.
      </footer>
    </main>
  );
}

export default App;
