// client/src/Dashboard.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  FaBars,
  FaBookmark,
  FaRegBookmark,
  FaGlobe,
  FaChartBar,
  FaCog,
  FaExternalLinkAlt,
  FaStar,
} from "react-icons/fa";
import { motion } from "framer-motion";

const API_BASE = "https://gaetan-feed.onrender.com/api";
const LIMIT = 10;
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/800x450.png?text=No+Image";

const CATEGORY_META = [
  { key: "all", label: "All", icon: <FaChartBar /> },
  { key: "Capital Strategy", label: "Capital Strategy", icon: <FaGlobe /> },
  { key: "Private Markets & M&A", label: "Private Markets & M&A", icon: <FaStar /> },
  { key: "Operational Excellence", label: "Operational Excellence", icon: <FaCog /> },
  { key: "Leadership & Conscious CFO", label: "Leadership & Conscious CFO", icon: <FaStar /> },
  { key: "Africa Finance", label: "Africa Finance", icon: <FaGlobe /> },
  { key: "Uncategorized", label: "Uncategorized", icon: <FaBars /> },
];

export default function Dashboard() {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewSavedOnly, setViewSavedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const observer = useRef(null);
  const lastCardRef = useRef(null);

  const safe = (v, fallback = "") => (v === undefined || v === null ? fallback : v);

  // Fetch articles
  const fetchArticles = useCallback(
    async (pageNumber = 1) => {
      if (loading) return;
      setLoading(true);
      try {
        const params = { page: pageNumber, limit: LIMIT };
        if (selectedCategory !== "all") params.category = selectedCategory;
        if (viewSavedOnly) params.saved = true;

        const res = await axios.get(`${API_BASE}/articles`, { params });
        const data = Array.isArray(res.data) ? res.data : [];

        setArticles((prev) => {
          // Page 1 → replace articles
          if (pageNumber === 1) return data;

          // Append for infinite scroll, prevent overwriting
          if (data.length === 0) return prev;
          const existingIds = new Set(prev.map((a) => a._id));
          return [...prev, ...data.filter((a) => !existingIds.has(a._id))];
        });

        setHasMore(data.length === LIMIT);
      } catch (err) {
        console.error("fetchArticles error:", err?.message || err);
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, viewSavedOnly, loading]
  );

  // Reset when category or saved filter changes
  useEffect(() => {
    setPage(1);
    setArticles([]);
    setHasMore(true);
    fetchArticles(1);
  }, [selectedCategory, viewSavedOnly]);

  // Load next page for infinite scroll
  useEffect(() => {
    if (page === 1) return;
    fetchArticles(page);
  }, [page]);

  // Infinite scroll observer
  useEffect(() => {
    if (loading || !hasMore) return;
    const node = lastCardRef.current;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setPage((p) => p + 1);
      },
      { threshold: 0.5 }
    );

    io.observe(node);
    observer.current = io;
    return () => io.disconnect();
  }, [loading, hasMore, articles]);

  // Toggle saved
  const toggleSave = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/articles/${id}/save`);
      const updated = res.data;
      setArticles((prev) => prev.map((a) => (a._id === id ? updated : a)));
    } catch (err) {
      console.error(err);
    }
  };

  // Mark as read
  const markAsRead = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/articles/${id}/read`);
      const updated = res.data;
      setArticles((prev) => prev.map((a) => (a._id === id ? updated : a)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-30 inset-y-0 left-0 bg-gray-800 shadow-lg w-64 transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
            <h1 className="text-xl font-bold text-white">CFO Dashboard</h1>
            <button
              className="p-2 rounded hover:bg-gray-700 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <FaBars />
            </button>
          </div>

          <nav className="p-4 flex-1 overflow-y-auto">
            <button
              onClick={() => {
                setSelectedCategory("all");
                setViewSavedOnly(false);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded mb-4 transition-colors ${
                selectedCategory === "all" && !viewSavedOnly
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-700"
              }`}
            >
              <FaChartBar />
              <span>All Articles</span>
            </button>

            <div className="text-xs uppercase text-gray-400 mb-2">Categories</div>

            {CATEGORY_META.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setSelectedCategory(c.key);
                  setViewSavedOnly(false);
                }}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded mb-1 transition-colors ${
                  selectedCategory === c.key && !viewSavedOnly
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-700"
                }`}
              >
                <span>{c.icon}</span>
                <span className="truncate">{c.label}</span>
              </button>
            ))}

            <div className="mt-6 border-t border-gray-700 pt-4">
              <button
                onClick={() => {
                  setViewSavedOnly(true);
                  setSelectedCategory("all");
                }}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded transition-colors ${
                  viewSavedOnly ? "bg-green-600 text-white" : "hover:bg-gray-700"
                }`}
              >
                <FaBookmark />
                <span>Saved Articles</span>
              </button>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded hover:bg-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <FaBars />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold">
                {viewSavedOnly
                  ? "Saved Articles"
                  : selectedCategory === "all"
                  ? "Latest Articles"
                  : selectedCategory}
              </h2>
              <p className="text-sm text-gray-400">
                {viewSavedOnly ? "Showing saved articles" : `Page ${page}`}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setPage(1);
              setArticles([]);
              setHasMore(true);
              fetchArticles(1);
            }}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition"
          >
            Refresh
          </button>
        </header>

        {/* Articles grid */}
        <main className="p-6 overflow-auto bg-gray-900 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {articles.length === 0 && !loading && (
              <div className="col-span-full text-center text-gray-400 py-10 bg-gray-800 rounded-lg shadow-lg">
                No articles found.
              </div>
            )}

            {articles.map((a, idx) => {
              const isLast = idx === articles.length - 1;
              return (
                <motion.article
                  key={a._id || a.url || idx}
                  ref={isLast ? lastCardRef : null}
                  className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:scale-[1.02] transform transition-all duration-300"
                  whileHover={{ scale: 1.03 }}
                >
                  <div className="h-44 bg-gray-700">
                    <img
                      src={safe(a.image, PLACEHOLDER_IMAGE)}
                      alt={a.title}
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = PLACEHOLDER_IMAGE)}
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold flex-1 pr-4">{a.title}</h3>
                      <button
                        onClick={() => toggleSave(a._id)}
                        className="p-2 rounded hover:bg-gray-700 transition"
                      >
                        {a.isSaved ? (
                          <FaBookmark className="text-yellow-400" />
                        ) : (
                          <FaRegBookmark />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {a.source} • {new Date(a.publishedDate).toLocaleDateString()}
                    </p>
                    <p className="text-gray-200 mt-2 flex-1 text-sm">{safe(a.description)}</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-gray-400">{a.category}</span>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markAsRead(a._id)}
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        Read <FaExternalLinkAlt />
                      </a>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {loading && (
            <div className="text-center mt-6 text-gray-400">Loading...</div>
          )}
        </main>
      </div>
    </div>
  );
}
