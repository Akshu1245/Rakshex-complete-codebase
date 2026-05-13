-- Research Module Schema Migration
-- Adds tables for research memory, competitive scans, and market intelligence.

-- Research Memory: stores completed research reports with sources and findings
CREATE TABLE IF NOT EXISTS research_memory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  topic VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  sources JSON NOT NULL,
  findings JSON NOT NULL,
  confidence_score INT NOT NULL DEFAULT 0,
  source_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_research_memory_user (user_id),
  INDEX idx_research_memory_topic (user_id, topic(255)),
  INDEX idx_research_memory_created (user_id, created_at DESC),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Competitive Scans: stores snapshots of competitor analysis
CREATE TABLE IF NOT EXISTS competitive_scans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  competitor_id VARCHAR(100) NOT NULL,
  competitor_name VARCHAR(200) NOT NULL,
  website_changes JSON NOT NULL,
  recent_news JSON NOT NULL,
  pricing_changes JSON NOT NULL,
  feature_changes JSON NOT NULL,
  blog_posts JSON NOT NULL,
  social_mentions JSON NOT NULL,
  threat_level ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
  summary TEXT NOT NULL,
  scanned_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comp_scan_competitor (competitor_id),
  INDEX idx_comp_scan_date (competitor_id, scanned_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Research Embeddings: stores vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS research_embeddings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  research_id INT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  embedding JSON NOT NULL COMMENT 'Float32 array stored as JSON for MySQL compatibility',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_research_embeddings_research (research_id),
  FOREIGN KEY (research_id) REFERENCES research_memory(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
