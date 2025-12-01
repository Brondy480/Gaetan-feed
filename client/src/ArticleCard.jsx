import React, { useState } from "react";
import { Bookmark, ExternalLink } from "lucide-react";

/**
 * ArticleCard.jsx
 * Minimal, elegant, Apple-like card
 */

export default function ArticleCard({ article, onToggleSave, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);

  const imageUrl = article.image || article.imageUrl || article.enclosure || null;
  const shortDesc = article.description ? article.description.slice(0, 180) : "";

  return (
    <article className={`bg-white rounded-2xl shadow-sm p-5 flex flex-col ${article.isRead ? "opacity-70" : ""}`}>
      {imageUrl && (
        <div className="w-full h-44 mb-4 overflow-hidden rounded-lg">
          <img src={imageUrl} alt={article.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs text-gray-600">{article.category || "Uncategorized"}</span>
        <span className="text-xs text-gray-500">{article.source}</span>
      </div>

      <h3 className="text-lg font-semibold mb-2">{article.title}</h3>

      {article.description ? (
        <p className="text-sm text-gray-700 mb-4">
          {expanded ? article.description : shortDesc}
          {article.description.length > 180 && (
            <button onClick={() => setExpanded(e => !e)} className="ml-2 text-xs text-black font-medium">
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-4">No description available.</p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <div className="text-xs text-gray-500">{new Date(article.publishedDate).toLocaleDateString()}</div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleSave(article._id)}
            className={`p-2 rounded-lg ${article.isSaved ? "bg-black text-white" : "bg-gray-100"}`}
            aria-label="Save article"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onMarkRead(article._id)}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            aria-label="Open article"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
