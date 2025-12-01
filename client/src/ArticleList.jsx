import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import ArticleCard from "./ArticleCard";

/**
 * ArticleList.jsx
 * - Stable pagination + IntersectionObserver sentinel
 * - Renders a responsive grid of ArticleCard
 */

const API_BASE = "http://localhost:5000/api/articles";
const PAGE_SIZE = 10;

export default function ArticleList({ category = "all", minScore = 1, showSaved = false }) {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1); // current page requested
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef(null);

  // Fetch a page (pageNumber)
  const fetchPage = useCallback(async (pageNumber = 1) => {
    if (loading) return;
    setLoading(true);

    try {
      const params = { page: pageNumber, limit: PAGE_SIZE };
      if (category && category !== "all") params.category = category;
      if (minScore) params.minScore = minScore;
      if (showSaved) params.saved = true;

      const res = await axios.get(API_BASE, { params });
      const data = Array.isArray(res.data) ? res.data : [];

      if (pageNumber === 1) setArticles(data);
      else setArticles((prev) => [...prev, ...data]);

      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error("fetchPage error:", err?.message || err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [category, minScore, showSaved, loading]);

  // Reset on filter change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setArticles([]);
    fetchPage(1);
  }, [category, minScore, showSaved, fetchPage]);

  // Load next pages when `page` increments
  useEffect(() => {
    if (page === 1) return; // already fetched by reset
    fetchPage(page);
  }, [page, fetchPage]);

  // IntersectionObserver sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.3 }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [hasMore, loading]);

  // optimistic toggle save handler forwarded to ArticleCard
  const handleToggleSave = async (id) => {
    setArticles((prev) => prev.map(a => a._id === id ? { ...a, isSaved: !a.isSaved } : a));
    try {
      await axios.patch(`http://localhost:5000/api/articles/${id}/save`);
    } catch (err) {
      console.error("toggleSave failed:", err);
    }
  };

  const handleMarkRead = async (id) => {
    setArticles((prev) => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
    try {
      await axios.patch(`http://localhost:5000/api/articles/${id}/read`);
    } catch (err) {
      console.error("markAsRead failed:", err);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard
            key={article._id}
            article={article}
            onToggleSave={() => handleToggleSave(article._id)}
            onMarkRead={() => handleMarkRead(article._id)}
          />
        ))}
      </div>

      {/* sentinel */}
      <div ref={sentinelRef} className="h-8" />

      {/* feedback */}
      <div className="mt-8 text-center">
        {loading && <div className="text-gray-600">Loading more articles…</div>}
        {!hasMore && !loading && articles.length > 0 && <div className="text-gray-400">No more articles</div>}
        {!loading && articles.length === 0 && <div className="text-gray-400">No articles found</div>}
      </div>
    </>
  );
}
