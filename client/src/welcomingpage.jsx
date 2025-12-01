// client/src/WelcomingPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const USER_NAME = "Gaetan Youmbi";
const fullText = "Global Intelligence. Powered by AI, curated for you.";

// Local finance image
const FINANCE_IMAGE = "/Imeuble.jpg";

export default function WelcomingPage() {
  const [typedText, setTypedText] = useState("");
  const videoRef = useRef(null);

  // Typewriter effect
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#04050a] text-white overflow-hidden">

      {/* Background video */}
      <video
        ref={videoRef}
        src="/world.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 flex flex-col lg:flex-row items-center gap-8">
        
        {/* Left: Content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          className="space-y-6 max-w-lg"
        >
          <h1 className="text-5xl md:text-6xl font-extrabold">
            Welcome, <span className="text-blue-400">{USER_NAME}</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300">
            <span className="font-medium text-white">Want to know what's happening around the world?</span>{" "}
            Dive into a curated, AI-powered feed delivering intelligence and stories that matter most to you.
          </p>
          <div className="flex gap-3 mt-4">
            <Link
              to="/dashboard"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg text-lg font-semibold hover:scale-[1.02] transform"
            >
              Enter Dashboard
            </Link>
          </div>
          <div className="mt-6 text-sm text-gray-300">
            <span className="font-medium text-white">Tip:</span> Explore the finance overview.
          </div>
        </motion.div>

        {/* Right: Local Finance Image */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          className="w-full lg:w-1/2 rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={FINANCE_IMAGE}
            alt="Finance"
            className="w-full h-auto object-cover rounded-2xl"
          />
        </motion.div>

      </div>

      {/* Typewriter text */}
      <div className="absolute bottom-10 w-full text-center">
        <span className="text-gray-300 text-sm md:text-base">
          {typedText}
          <span className="border-r-2 border-blue-400 ml-1 animate-pulse"></span>
        </span>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-6 text-xs text-slate-400">
        © {new Date().getFullYear()} {USER_NAME} — Private Intelligence Feed
      </div>
    </div>
  );
}
