const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const cors = require("cors");
const puppeteer = require("puppeteer");
const multer = require("multer");
const { google } = require("googleapis");
const OpenAI = require("openai");
require("dotenv").config();

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/generated", express.static("generated"));

// Multer configuration for file uploads
const upload = multer({ dest: "./temp/" });

// API Configuration
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// YouTube API Configuration
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const YOUTUBE_REDIRECT_URI =
  process.env.YOUTUBE_REDIRECT_URI ||
  "http://localhost:3000/auth/youtube/callback";

// OAuth2 client for YouTube
const oauth2Client = new google.auth.OAuth2(
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_REDIRECT_URI
);

// YouTube API instance
const youtube = google.youtube({ version: "v3", auth: oauth2Client });

// OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Store access tokens (in production, use a database)
let youtubeTokens = {};

// Murf.ai Voice IDs (these are example IDs - you may need to update with actual voice IDs)
const MURF_VOICE_IDS = {
  male: "VM016944248927101HE",
  female: "VF017854738904051HE",
  conversational: "VM016944248927101HE",
  professional: "VM017234567890123HE",
  friendly: "VF018765432109876HE",
};

// Voice styles available in Murf.ai
const MURF_VOICE_STYLES = {
  conversational: "Conversational",
  professional: "Professional",
  friendly: "Friendly",
  energetic: "Energetic",
  calm: "Calm",
};

// OpenAI Content Generation Templates
const CONTENT_TEMPLATES = {
  tutorial: `Create a short, engaging tutorial script for a YouTube Short about {topic}. 
Make it educational but fun, under 60 seconds when spoken. 
Include a hook at the beginning and a call to action at the end.
Focus on practical tips that viewers can immediately use.`,

  explanation: `Write a clear, concise explanation script for a YouTube Short about {topic}.
Make it beginner-friendly but informative. Keep it under 60 seconds when spoken.
Start with why this topic matters, then explain the concept simply.`,

  tips: `Create a quick tips script for a YouTube Short about {topic}.
List 3-5 actionable tips that viewers can use right away.
Make it energetic and valuable. Keep it under 60 seconds when spoken.
Start with a compelling hook about the benefits.`,

  comparison: `Write a comparison script for a YouTube Short comparing {topic}.
Highlight the key differences and when to use each option.
Make it balanced and informative. Keep it under 60 seconds when spoken.
End with a clear recommendation.`,

  problem_solution: `Create a problem-solution script for a YouTube Short about {topic}.
Start by identifying a common problem, then provide a clear solution.
Make it relatable and actionable. Keep it under 60 seconds when spoken.
Include specific examples.`,
};

// OpenAI Functions

// Generate content script using OpenAI
async function generateContentScript(
  prompt,
  contentType = "tutorial",
  additionalContext = ""
) {
  try {
    const template =
      CONTENT_TEMPLATES[contentType] || CONTENT_TEMPLATES.tutorial;
    const fullPrompt =
      template.replace("{topic}", prompt) +
      (additionalContext ? `\n\nAdditional context: ${additionalContext}` : "");

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a professional YouTube Shorts script writer. Create engaging, concise scripts that are perfect for short-form video content. Focus on hooks, value, and clear delivery.",
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating content script:", error);
    throw error;
  }
}

// Generate code examples using OpenAI
async function generateCodeExample(
  topic,
  language = "javascript",
  complexity = "beginner"
) {
  try {
    const prompt = `Generate a clean, well-commented ${language} code example for ${topic}. 
Make it ${complexity} level - practical and useful for learning.
Keep it concise but complete, suitable for a code snippet in a video.
Include comments explaining key concepts.
Format it properly for syntax highlighting.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert programmer and educator. Create clean, educational code examples that are perfect for teaching concepts.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating code example:", error);
    throw error;
  }
}

// Generate video title and description using OpenAI
async function generateVideoMetadata(content, topic = "") {
  try {
    const prompt = `Based on this video content, generate:
1. An engaging YouTube title (under 60 characters)
2. A compelling description (2-3 sentences)
3. 5 relevant tags

Content: "${content}"
Topic: "${topic}"

Format your response as JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a YouTube optimization expert. Create titles and descriptions that drive engagement and views while accurately representing the content.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    try {
      return JSON.parse(response.choices[0].message.content.trim());
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        title: topic || "AI Generated Content",
        description: "Educational content generated with AI",
        tags: ["ai", "education", "tutorial", "programming", "tech"],
      };
    }
  } catch (error) {
    console.error("Error generating video metadata:", error);
    throw error;
  }
}

async function generateCompleteVideoData(prompt) {
  try {
    const systemPrompt = `You are an expert YouTube Shorts content creator and programmer. Given a user prompt, generate ALL the necessary data for creating a complete coding tutorial video.

Analyze the prompt and generate:
1. Programming language to use
2. Complexity level (beginner/intermediate/advanced)
3. Engaging script for the video
4. Clean, well-commented code example
5. YouTube-optimized title, description, and tags
6. Background image search query
7. Content category for background media

Return ONLY a JSON object with this exact structure:
{
  "language": "language_name",
  "complexity": "beginner|intermediate|advanced",
  "script": "engaging voiceover script under 60 seconds",
  "code": "clean, commented code example",
  "metadata": {
    "title": "engaging YouTube title under 60 chars",
    "shortTitle":"maximum 2-3 word title to use inside video",
    "description": "compelling description 2-3 sentences",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  },
  "backgroundQuery": "search query for background images/videos be accurate like python will result in snakes image/video so use like programming",
  "category": "pixabay category"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Create a YouTube Short about: ${prompt}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    try {
      const aiData = JSON.parse(response.choices[0].message.content.trim());

      // Validate required fields
      const requiredFields = [
        "language",
        "complexity",
        "script",
        "code",
        "metadata",
        "backgroundQuery",
        "category",
      ];
      for (const field of requiredFields) {
        if (!aiData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return aiData;
    } catch (parseError) {
      console.error("Failed to parse AI response, using fallback approach...");

      // Fallback: Generate each component separately
      const [script, code, metadata] = await Promise.all([
        generateContentScript(prompt, "tutorial"),
        generateCodeExample(prompt, "python", "beginner"),
        generateVideoMetadata(`Tutorial about ${prompt}`, prompt),
      ]);

      return {
        language: detectLanguage(code) || "python",
        complexity: "beginner",
        script,
        code,
        metadata,
        backgroundQuery: `${prompt} programming coding`,
        category: "science",
      };
    }
  } catch (error) {
    console.error("Error generating complete video data:", error);
    throw error;
  }
}

// Generate beautiful code snippet image using HTML rendering
async function generateCodeSnippetImage(
  code,
  language = "javascript",
  videoId,
  title = "Code Snippet"
) {
  try {
    // Try ray.so first
    return await generateCodeSnippetWithRayso(code, language, videoId, title);
  } catch (fallbackError) {
    console.error("Both ray.so and fallback failed:", fallbackError);
    throw fallbackError;
  }
}

// Generate code snippet image using ray.so
async function generateCodeSnippetWithRayso(
  code,
  language = "javascript",
  videoId,
  title = "Code Snippet"
) {
  try {
    // Encode the code to base64
    const encodedCode = Buffer.from(code).toString("base64");

    // Create ray.so URL
    const raysoUrl = `https://www.ray.so/#width=null&code=${encodedCode}&padding=16&background=true&theme=vercel&darkMode=true&language=${language}&title=${encodeURIComponent(
      title
    )}`;

    console.log("Ray.so URL:", raysoUrl);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    // Navigate to ray.so URL
    await page.goto(raysoUrl, { waitUntil: "networkidle0" });

    // Wait for the resizable frame to load
    await page.waitForSelector('div[class*="ResizableFrame"]', {
      timeout: 10000,
    });

    // Wait a bit more for full rendering

    await page.evaluate(
      `window.location.href = window.location.href.replace("padding=64","padding=0")`
    );

    // Take screenshot of the specific element
    const element = await page.$('div[class*="ResizableFrame"]');

    if (!element) {
      throw new Error("ResizableFrame element not found");
    }

    const imagePath = path.join("./temp", `${videoId}_code_snippet.png`);

    await element.screenshot({
      path: imagePath,
      omitBackground: false,
    });

    await browser.close();
    console.log("Ray.so code snippet image saved:", imagePath);
    return imagePath;
  } catch (error) {
    console.error("Error generating code snippet with ray.so:", error);
    throw error;
  }
}

// Detect programming language from code
function detectLanguage(code) {
  if (
    code.includes("def ") ||
    code.includes("import ") ||
    code.includes("print(")
  )
    return "python";
  if (
    code.includes("function ") ||
    code.includes("const ") ||
    code.includes("let ")
  )
    return "javascript";
  if (code.includes("public class") || code.includes("System.out"))
    return "java";
  if (code.includes("#include") || code.includes("int main")) return "cpp";
  if (code.includes("<?php")) return "php";
  if (code.includes("SELECT") || code.includes("FROM")) return "sql";
  if (code.includes("<html") || code.includes("<div")) return "html";
  if (code.includes("body {") || code.includes(".class")) return "css";
  return "javascript"; // default
}

// Pixabay API functions
async function searchStockVideos(query, category = "all") {
  try {
    const response = await axios.get("https://pixabay.com/api/videos/", {
      params: {
        key: PIXABAY_API_KEY,
        q: query,
        category: category,
        video_type: "all",
        orientation: "vertical", // For shorts format
        safesearch: "true",
        per_page: 10,
        order: "popular",
      },
    });

    return response.data.hits;
  } catch (error) {
    console.error("Error fetching stock videos:", error);
    return [];
  }
}

async function searchStockImages(query, category = "all") {
  try {
    const response = await axios.get("https://pixabay.com/api/", {
      params: {
        key: PIXABAY_API_KEY,
        q: query,
        category: category,
        image_type: "photo",
        orientation: "vertical",
        safesearch: "true",
        per_page: 10,
        min_width: 1080,
      },
    });

    return response.data.hits;
  } catch (error) {
    console.error("Error fetching stock images:", error);
    return [];
  }
}

// Murf.ai TTS function
async function generateVoice(
  text,
  voiceType = "male",
  style = "conversational"
) {
  try {
    const voiceId = MURF_VOICE_IDS[voiceType] || MURF_VOICE_IDS["male"];
    const voiceStyle =
      MURF_VOICE_STYLES[style] || MURF_VOICE_STYLES["conversational"];

    // URL encode the text
    const encodedText = encodeURIComponent(text);

    // Construct the Murf.ai API URL
    const murfUrl = `https://murf.ai/Prod/anonymous-tts/audio?text=${encodedText}&voiceId=${voiceId}&style=${voiceStyle}`;

    console.log("Calling Murf.ai TTS:", murfUrl);

    const response = await axios.get(murfUrl, {
      responseType: "arraybuffer",
      headers: {
        Accept: "audio/mpeg, audio/wav, audio/*",
        "User-Agent": "YouTube-Shorts-Generator/1.0",
      },
      timeout: 30000, // 30 second timeout
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error("Error generating voice with Murf.ai:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response headers:", error.response.headers);
    }
    throw error;
  }
}

// Download media function
async function downloadMedia(url, filename) {
  try {
    const response = await axios.get(url, { responseType: "stream" });
    const filePath = path.join("./temp", filename);
    const writer = require("fs").createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(filePath));
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("Error downloading media:", error);
    throw error;
  }
}

// Video generation function
async function generateVideo(config) {
  const {
    title,
    content,
    code,
    voiceType,
    voiceStyle,
    duration,
    category,
    videoId,
  } = config;

  try {
    // 1. Generate voice using Murf.ai
    console.log("Generating voice with Murf.ai...");
    const audioBuffer = await generateVoice(content, voiceType, voiceStyle);
    const audioPath = path.join("./temp", `${videoId}_audio.mp3`);
    await fs.writeFile(audioPath, audioBuffer);

    // 2. Search and download background video/image
    console.log("Searching for background media...");
    let backgroundPath;

    // Try to get vertical videos first, fallback to images
    const videos = await searchStockVideos(category, category);

    if (videos.length > 0) {
      // Use video background
      const video = videos[0];
      const videoUrl = video.videos.medium?.url || video.videos.small?.url;
      if (videoUrl) {
        backgroundPath = await downloadMedia(
          videoUrl,
          `${videoId}_background.mp4`
        );
      }
    }

    if (!backgroundPath) {
      // Fallback to image background
      const images = await searchStockImages(category, category);
      if (images.length > 0) {
        const imageUrl = images[0].largeImageURL || images[0].webformatURL;
        backgroundPath = await downloadMedia(
          imageUrl,
          `${videoId}_background.jpg`
        );
      }
    }

    // 3. Generate beautiful code snippet image if code is provided
    let codeImagePath = null;
    if (code) {
      console.log("Generating code snippet image...");
      const language = detectLanguage(code);

      // Use ray.so approach with title
      codeImagePath = await generateCodeSnippetImage(
        code,
        language,
        videoId,
        title
      );
      console.log("Code image generated:", codeImagePath);
    }

    // 4. Create subtitle file
    const subtitleContent = generateSubtitles(content, duration);
    const subtitlePath = path.join("./temp", `${videoId}_subtitles.srt`);
    await fs.writeFile(subtitlePath, subtitleContent);

    // 5. Generate video with FFmpeg
    console.log("Generating video...");
    const outputPath = path.join("./generated", `${videoId}.mp4`);

    await new Promise((resolve, reject) => {
      let command = ffmpeg();
      let inputIndex = 0;

      // Add background (video or image)
      if (backgroundPath && backgroundPath.endsWith(".mp4")) {
        command = command
          .input(backgroundPath)
          .inputOptions(["-stream_loop -1", `-t ${duration}`]);
        inputIndex++;
      } else if (backgroundPath) {
        command = command
          .input(backgroundPath)
          .inputOptions(["-loop 1", `-t ${duration}`]);
        inputIndex++;
      }

      // Add code image if available
      if (codeImagePath) {
        command = command.input(codeImagePath);
        inputIndex++;
      }

      // Add audio
      command = command.input(audioPath);

      // Build filter chain
      let filterComplex = [];
      let currentStream = "[0:v]";

      // Scale and crop background to 9:16 aspect ratio
      filterComplex.push(
        `${currentStream}scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`
      );
      currentStream = "[bg]";

      // Add title overlay
      const escapedTitle = title.replace(/[\\':]/g, "\\$&");
      filterComplex.push(
        `${currentStream}drawtext=text='${escapedTitle}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=100:box=1:boxcolor=black@0.7:boxborderw=10[titled]`
      );
      currentStream = "[titled]";

      // Add code image overlay if available
      if (codeImagePath) {
        const codeInputIndex = backgroundPath ? 1 : 0;
        filterComplex.push(`[${codeInputIndex}:v]scale=900:500[code]`);
        filterComplex.push(`${currentStream}[code]overlay=90:600[final]`);
        currentStream = "[final]";
      }

      // If no code overlay, rename the current stream to final
      if (!codeImagePath) {
        filterComplex[filterComplex.length - 1] = filterComplex[
          filterComplex.length - 1
        ].replace("[titled]", "[final]");
        currentStream = "[final]";
      }

      console.log("Filter complex:", filterComplex.join(";"));

      command
        .complexFilter(filterComplex.join(";"))
        .outputOptions([
          "-map [final]",
          `-map ${inputIndex}:a`, // Map audio from the last input
          "-c:v libx264",
          "-c:a aac",
          "-preset fast",
          "-crf 23",
          "-r 30",
          "-shortest",
        ])
        .output(outputPath)
        .on("end", () => {
          console.log("Video generation completed");
          resolve(outputPath);
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .run();
    });

    return outputPath;
  } catch (error) {
    console.error("Error in video generation:", error);
    throw error;
  }
}

// Generate subtitle file (SRT format)
function generateSubtitles(text, duration) {
  const words = text.split(" ");
  const wordsPerSecond = words.length / duration;
  let srtContent = "";
  let currentTime = 0;

  for (let i = 0; i < words.length; i += 5) {
    const chunk = words.slice(i, i + 5).join(" ");
    const startTime = formatTime(currentTime);
    currentTime += 5 / wordsPerSecond;
    const endTime = formatTime(currentTime);

    srtContent += `${Math.floor(i / 5) + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${chunk}\n\n`;
  }

  return srtContent;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

// API Routes
app.post("/api/generate-video", async (req, res) => {
  try {
    const {
      title,
      content,
      code,
      voiceType = "male",
      voiceStyle = "conversational",
      duration = 60,
      category = "technology",
      uploadToYoutube = false,
      youtubeMetadata = {},
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const videoId = `video_${Date.now()}`;

    // Generate video
    const outputPath = await generateVideo({
      title,
      content,
      code,
      voiceType,
      voiceStyle,
      duration,
      category,
      videoId,
    });

    let youtubeResult = null;

    // Upload to YouTube if requested
    if (uploadToYoutube) {
      try {
        youtubeResult = await uploadToYouTube(outputPath, {
          title: youtubeMetadata.title || title,
          description: youtubeMetadata.description || content,
          tags: youtubeMetadata.tags || ["ai", "shorts", "programming"],
          privacyStatus: youtubeMetadata.privacyStatus || "private",
        });
      } catch (youtubeError) {
        console.error("YouTube upload failed:", youtubeError);
        // Continue without failing the entire request
        youtubeResult = {
          success: false,
          error: youtubeError.message,
        };
      }
    }

    res.json({
      success: true,
      videoId,
      downloadUrl: `/generated/${videoId}.mp4`,
      message: "Video generated successfully",
      youtube: youtubeResult,
    });
  } catch (error) {
    console.error("Video generation error:", error);
    res.status(500).json({
      error: "Failed to generate video",
      details: error.message,
    });
  }
});

// Upload existing video to YouTube
app.post("/api/youtube/upload", upload.single("video"), async (req, res) => {
  try {
    const { title, description, tags, privacyStatus = "private" } = req.body;
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({ error: "No video file provided" });
    }

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const result = await uploadToYouTube(videoFile.path, {
      title,
      description,
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
      privacyStatus,
    });

    // Clean up uploaded file
    await fs.unlink(videoFile.path);

    res.json(result);
  } catch (error) {
    console.error("YouTube upload error:", error);
    res.status(500).json({
      error: "Failed to upload to YouTube",
      details: error.message,
    });
  }
});

// Get YouTube channel info
app.get("/api/youtube/channel", async (req, res) => {
  try {
    if (!youtubeTokens.access_token) {
      return res.status(401).json({ error: "Not authenticated with YouTube" });
    }

    oauth2Client.setCredentials(youtubeTokens);

    const response = await youtube.channels.list({
      part: "snippet,statistics",
      mine: true,
    });

    if (response.data.items.length === 0) {
      return res.status(404).json({ error: "No channel found" });
    }

    const channel = response.data.items[0];
    res.json({
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      subscriberCount: channel.statistics.subscriberCount,
      videoCount: channel.statistics.videoCount,
      viewCount: channel.statistics.viewCount,
    });
  } catch (error) {
    console.error("Error fetching channel info:", error);
    res.status(500).json({
      error: "Failed to fetch channel info",
      details: error.message,
    });
  }
});

// Get user's YouTube videos
app.get("/api/youtube/videos", async (req, res) => {
  try {
    if (!youtubeTokens.access_token) {
      return res.status(401).json({ error: "Not authenticated with YouTube" });
    }

    oauth2Client.setCredentials(youtubeTokens);

    const response = await youtube.search.list({
      part: "snippet",
      forMine: true,
      type: "video",
      maxResults: 10,
      order: "date",
    });

    const videos = response.data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.default.url,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    res.json({ videos });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({
      error: "Failed to fetch videos",
      details: error.message,
    });
  }
});

// YouTube Authentication
app.get("/auth/youtube", (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  res.redirect(authUrl);
});

// YouTube OAuth callback
app.get("/auth/youtube/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    youtubeTokens = tokens;

    // Save tokens persistently
    await saveYouTubeTokens(tokens);

    // Store in session
    if (req.session) {
      req.session.youtubeAuth = true;
      req.session.channelInfo = null; // Will be loaded when needed
    }

    console.log("YouTube authentication successful and saved");

    res.send(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✅ YouTube Authentication Successful!</h2>
            <p>Your authentication has been saved and will persist across restarts.</p>
            <p>You can now close this window and return to the dashboard.</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error getting YouTube tokens:", error);
    res.status(500).send(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>❌ Authentication Failed</h2>
            <p>Please try again or check your API credentials.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// API to get current progress
app.get("/api/progress", (req, res) => {
  res.json(currentProgress);
});

// API to get authentication status with channel info
app.get("/api/auth-status", async (req, res) => {
  try {
    const isAuthenticated = !!youtubeTokens.access_token;
    let channelInfo = null;

    if (isAuthenticated) {
      try {
        oauth2Client.setCredentials(youtubeTokens);
        const response = await youtube.channels.list({
          part: "snippet,statistics",
          mine: true,
        });

        if (response.data.items.length > 0) {
          const channel = response.data.items[0];
          channelInfo = {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            subscriberCount: channel.statistics.subscriberCount,
            videoCount: channel.statistics.videoCount,
            viewCount: channel.statistics.viewCount,
            thumbnailUrl:
              channel.snippet.thumbnails.default?.url ||
              channel.snippet.thumbnails.medium?.url,
          };
        }
      } catch (error) {
        console.error("Error fetching channel info:", error);
      }
    }

    res.json({
      authenticated: isAuthenticated,
      channelInfo,
      openaiConnected: !!OPENAI_API_KEY,
      pixabayConnected: !!PIXABAY_API_KEY,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get auth status" });
  }
});

// Add test OpenAI endpoint
app.get("/api/test-openai", async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "user", content: "Hello! Just testing the connection." },
      ],
      max_tokens: 10,
    });

    res.json({
      success: true,
      message: "OpenAI connection successful",
      model: "gpt-4",
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
});

async function uploadToYouTube(videoPath, metadata) {
  try {
    if (!youtubeTokens.access_token) {
      throw new Error(
        "Not authenticated with YouTube. Please authenticate first."
      );
    }

    oauth2Client.setCredentials(youtubeTokens);

    const videoMetadata = {
      snippet: {
        title: metadata.title || "Untitled Video",
        description:
          metadata.description || "Generated with AI YouTube Shorts Generator",
        tags: metadata.tags || ["ai", "shorts", "coding", "programming"],
        categoryId: "28", // Science & Technology
        defaultLanguage: "en",
        defaultAudioLanguage: "en",
      },
      status: {
        privacyStatus: metadata.privacyStatus || "private", // private, unlisted, public
        madeForKids: false,
        selfDeclaredMadeForKids: false,
      },
    };

    const media = {
      mimeType: "video/mp4",
      body: require("fs").createReadStream(videoPath),
    };

    console.log("Uploading video to YouTube...");
    const response = await youtube.videos.insert({
      part: "snippet,status",
      resource: videoMetadata,
      media: media,
    });

    console.log("Video uploaded successfully:", response.data.id);
    return {
      success: true,
      videoId: response.data.id,
      videoUrl: `https://www.youtube.com/watch?v=${response.data.id}`,
      title: response.data.snippet.title,
    };
  } catch (error) {
    console.error("YouTube upload error:", error);
    throw error;
  }
}

// Enhanced video generation with progress tracking
async function generateVideoWithProgress(config) {
  const steps = [
    "Generating voice with Murf.ai",
    "Searching for background media",
    "Generating code snippet image",
    "Creating subtitles",
    "Rendering video with FFmpeg",
  ];

  updateProgress("Starting video generation", 0, steps.length);

  try {
    // Step 1: Generate voice
    updateProgress(steps[0], 1, steps.length);
    const audioBuffer = await generateVoice(
      config.content,
      config.voiceType,
      config.voiceStyle
    );
    const audioPath = path.join("./temp", `${config.videoId}_audio.mp3`);
    await fs.writeFile(audioPath, audioBuffer);

    // Step 2: Background media
    updateProgress(steps[1], 2, steps.length);
    let backgroundPath;
    const videos = await searchStockVideos(config.category, config.category);

    if (videos.length > 0) {
      const video = videos[0];
      const videoUrl = video.videos.medium?.url || video.videos.small?.url;
      if (videoUrl) {
        backgroundPath = await downloadMedia(
          videoUrl,
          `${config.videoId}_background.mp4`
        );
      }
    }

    if (!backgroundPath) {
      const images = await searchStockImages(config.category, config.category);
      if (images.length > 0) {
        const imageUrl = images[0].largeImageURL || images[0].webformatURL;
        backgroundPath = await downloadMedia(
          imageUrl,
          `${config.videoId}_background.jpg`
        );
      }
    }

    // Step 3: Code snippet
    updateProgress(steps[2], 3, steps.length);
    let codeImagePath = null;
    if (config.code) {
      const language = detectLanguage(config.code);
      codeImagePath = await generateCodeSnippetImage(
        config.code,
        language,
        config.videoId,
        config.title
      );
    }

    // Step 4: Subtitles
    updateProgress(steps[3], 4, steps.length);
    const subtitleContent = generateSubtitles(config.content, config.duration);
    const subtitlePath = path.join("./temp", `${config.videoId}_subtitles.srt`);
    await fs.writeFile(subtitlePath, subtitleContent);

    // Step 5: Video rendering
    updateProgress(steps[4], 5, steps.length);
    const outputPath = await generateVideoFFmpeg(
      config,
      backgroundPath,
      codeImagePath,
      audioPath
    );

    updateProgress("Video generation completed", steps.length, steps.length);
    currentProgress.completedVideos++;

    return outputPath;
  } catch (error) {
    currentProgress.errors.push(error.message);
    throw error;
  }
}

// Enhanced AI video creation with progress tracking
app.post("/api/ai/create-video-from-prompt", async (req, res) => {
  try {
    const {
      prompt,
      voiceType = "male",
      voiceStyle = "conversational",
      duration = 60,
      uploadToYoutube = true,
      privacyStatus = "private",
      autoPublish = false,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (currentProgress.isProcessing) {
      return res.status(429).json({
        error: "Another video is currently being processed. Please wait.",
        currentTask: currentProgress.currentTask,
      });
    }

    console.log(`🤖 Starting AI-powered video creation for: "${prompt}"`);
    const videoId = `ai_complete_${Date.now()}`;

    currentProgress = {
      isProcessing: true,
      currentTask: "Initializing",
      progress: 0,
      totalSteps: 8,
      videosInQueue: 1,
      completedVideos: currentProgress.completedVideos,
      errors: [],
    };

    // Step 1: Generate AI data
    updateProgress("Generating comprehensive video data with AI", 1, 8);
    const aiData = await generateCompleteVideoData(prompt);

    // Step 2-6: Generate video with progress tracking
    const outputPath = await generateVideoWithProgress({
      title: "Sufficient Code",
      content: aiData.script,
      code: aiData.code,
      voiceType,
      voiceStyle,
      duration,
      category: aiData.backgroundQuery,
      videoId,
    });

    let youtubeResult = null;

    // Step 7: Upload to YouTube
    if (uploadToYoutube) {
      try {
        updateProgress("Uploading to YouTube", 7, 8);
        youtubeResult = await uploadToYouTube(outputPath, {
          title: aiData.metadata.title,
          description: aiData.metadata.description,
          tags: aiData.metadata.tags,
          privacyStatus: autoPublish ? "public" : privacyStatus,
        });
      } catch (youtubeError) {
        console.error("❌ YouTube upload failed:", youtubeError);
        youtubeResult = {
          success: false,
          error: youtubeError.message,
        };
      }
    }

    updateProgress("Process completed", 8, 8);

    setTimeout(() => {
      currentProgress.isProcessing = false;
    }, 2000);

    res.json({
      success: true,
      message: "🎉 Video created successfully from AI prompt!",
      videoId,
      downloadUrl: `/generated/${videoId}.mp4`,
      prompt: prompt,
      aiGenerated: {
        language: aiData.language,
        complexity: aiData.complexity,
        script: aiData.script,
        code: aiData.code,
        metadata: aiData.metadata,
        backgroundQuery: aiData.backgroundQuery,
        category: aiData.category,
      },
      youtube: youtubeResult,
      processingTime: `Generated in ${Math.round(
        (Date.now() - parseInt(videoId.split("_")[2])) / 1000
      )}s`,
    });
  } catch (error) {
    console.error("❌ AI video creation error:", error);
    currentProgress.isProcessing = false;
    currentProgress.errors.push(error.message);

    res.status(500).json({
      error: "Failed to create video from prompt",
      details: error.message,
      prompt: req.body.prompt,
    });
  }
});

// Load session management
const session = require("express-session");
const FileStore = require("session-file-store")(session);

// Add session middleware
app.use(
  session({
    store: new FileStore({
      path: "./sessions",
      retries: 1,
      ttl: 86400 * 7, // 7 days
    }),
    secret: process.env.SESSION_SECRET || "youtube-shorts-generator-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true in production with HTTPS
      httpOnly: true,
      maxAge: 86400 * 7 * 1000, // 7 days
    },
  })
);

// Load persistent YouTube tokens from file
async function loadYouTubeTokens() {
  try {
    const tokensPath = path.join(__dirname, "youtube_tokens.json");
    const data = await fs.readFile(tokensPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Save YouTube tokens to file
async function saveYouTubeTokens(tokens) {
  try {
    const tokensPath = path.join(__dirname, "youtube_tokens.json");
    await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error("Error saving YouTube tokens:", error);
  }
}

// Initialize tokens on startup
async function initializeTokens() {
  const savedTokens = await loadYouTubeTokens();
  if (savedTokens.access_token) {
    youtubeTokens = savedTokens;
    oauth2Client.setCredentials(youtubeTokens);
    console.log("✅ YouTube authentication restored from saved tokens");
  }
}

// Progress tracking
let currentProgress = {
  isProcessing: false,
  currentTask: "",
  progress: 0,
  totalSteps: 0,
  videosInQueue: 0,
  completedVideos: 0,
  errors: [],
};

// Add progress update function
function updateProgress(task, progress, totalSteps) {
  currentProgress = {
    ...currentProgress,
    currentTask: task,
    progress,
    totalSteps,
    isProcessing: progress < totalSteps,
  };
}

// YouTube OAuth callback - updated to save tokens
app.get("/auth/youtube/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    youtubeTokens = tokens;

    // Save tokens persistently
    await saveYouTubeTokens(tokens);

    // Store in session
    req.session.youtubeAuth = true;
    req.session.channelInfo = null; // Will be loaded when needed

    console.log("YouTube authentication successful and saved");

    res.send(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✅ YouTube Authentication Successful!</h2>
            <p>Your authentication has been saved and will persist across restarts.</p>
            <p>You can now close this window and return to the dashboard.</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error getting YouTube tokens:", error);
    res.status(500).send(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>❌ Authentication Failed</h2>
            <p>Please try again or check your API credentials.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// API to get current progress
app.get("/api/progress", (req, res) => {
  res.json(currentProgress);
});

// API to get authentication status with channel info
app.get("/api/auth-status", async (req, res) => {
  try {
    const isAuthenticated = !!youtubeTokens.access_token;
    let channelInfo = null;

    if (isAuthenticated) {
      try {
        oauth2Client.setCredentials(youtubeTokens);
        const response = await youtube.channels.list({
          part: "snippet,statistics",
          mine: true,
        });

        if (response.data.items.length > 0) {
          const channel = response.data.items[0];
          channelInfo = {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            subscriberCount: channel.statistics.subscriberCount,
            videoCount: channel.statistics.videoCount,
            viewCount: channel.statistics.viewCount,
            thumbnailUrl:
              channel.snippet.thumbnails.default?.url ||
              channel.snippet.thumbnails.medium?.url,
          };
        }
      } catch (error) {
        console.error("Error fetching channel info:", error);
      }
    }

    res.json({
      authenticated: isAuthenticated,
      channelInfo,
      openaiConnected: !!OPENAI_API_KEY,
      pixabayConnected: !!PIXABAY_API_KEY,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get auth status" });
  }
});

// Enhanced main route with interactive dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Helper function for FFmpeg video generation
async function generateVideoFFmpeg(
  config,
  backgroundPath,
  codeImagePath,
  audioPath
) {
  const outputPath = path.join("./generated", `${config.videoId}.mp4`);

  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    let inputIndex = 0;

    // Add background
    if (backgroundPath && backgroundPath.endsWith(".mp4")) {
      command = command
        .input(backgroundPath)
        .inputOptions(["-stream_loop -1", `-t ${config.duration}`]);
      inputIndex++;
    } else if (backgroundPath) {
      command = command
        .input(backgroundPath)
        .inputOptions(["-loop 1", `-t ${config.duration}`]);
      inputIndex++;
    }

    // Add code image
    if (codeImagePath) {
      command = command.input(codeImagePath);
      inputIndex++;
    }

    // Add audio
    command = command.input(audioPath);

    // Build filter chain
    let filterComplex = [];
    let currentStream = "[0:v]";

    filterComplex.push(
      `${currentStream}scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]`
    );
    currentStream = "[bg]";

    const escapedTitle = config.title.replace(/[\\':]/g, "\\$&");
    filterComplex.push(
      `${currentStream}drawtext=text='${escapedTitle}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=100:box=1:boxcolor=black@0.7:boxborderw=10[titled]`
    );
    currentStream = "[titled]";

    if (codeImagePath) {
      const codeInputIndex = backgroundPath ? 1 : 0;
      filterComplex.push(`[${codeInputIndex}:v]scale=900:500[code]`);
      filterComplex.push(`${currentStream}[code]overlay=90:600[final]`);
      currentStream = "[final]";
    } else {
      filterComplex[filterComplex.length - 1] = filterComplex[
        filterComplex.length - 1
      ].replace("[titled]", "[final]");
    }

    command
      .complexFilter(filterComplex.join(";"))
      .outputOptions([
        "-map [final]",
        `-map ${inputIndex}:a`, // Map audio from the last input
        "-c:v libx264",
        "-c:a aac",
        "-preset fast",
        "-crf 23",
        "-r 30",
        "-shortest",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

// Update existing ensureDirectories function to include sessions
async function ensureDirectories() {
  const dirs = ["./temp", "./generated", "./public", "./sessions"];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
}

// Initialize tokens and start server
async function startServer() {
  await ensureDirectories();
  await initializeTokens();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log("🤖 Using OpenAI for AI content generation");
    console.log("🎤 Using Murf.ai for Text-to-Speech");
    console.log("📺 YouTube integration enabled");
    console.log("💾 Persistent login state enabled");
    console.log("📊 Interactive dashboard available");
    console.log("📝 Make sure to set up your .env file with all required keys");
  });
}

startServer();

module.exports = app;
