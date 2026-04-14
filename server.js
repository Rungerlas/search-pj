const express = require('express');
const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Directories and files to exclude from search
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  '.idea',
  '.vscode',
  'vendor',
  'target',
  '.gradle',
  '.mvn',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.lock',
  '.log',
  '.min.js',
  '.min.css',
  '.map',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.mp4',
  '.mp3',
  '.wav',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.class',
  '.jar',
  '.war',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.bin',
  '.dat',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Gemfile.lock',
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
  '.gitignore',
  '.npmignore',
  '.eslintignore',
  '.prettierignore',
]);

function shouldExclude(filePath, stat) {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (stat.isDirectory()) {
    return EXCLUDED_DIRS.has(basename) || basename.startsWith('.');
  }

  if (EXCLUDED_FILES.has(basename)) return true;
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;

  // Exclude minified files by pattern
  if (/\.(min|bundle|chunk)\.(js|css)$/.test(basename)) return true;

  return false;
}

function collectFiles(dir, fileList = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (shouldExclude(fullPath, stat)) continue;

      if (stat.isDirectory()) {
        collectFiles(fullPath, fileList);
      } else if (stat.isFile()) {
        fileList.push(fullPath);
      }
    } catch {
      // skip unreadable files
    }
  }

  return fileList;
}

function searchInFile(filePath, keyword, isRegex, isCaseSensitive) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Skip binary-like files
  if (content.includes('\0')) return null;

  const lines = content.split('\n');
  const matches = [];

  let pattern;
  try {
    if (isRegex) {
      pattern = new RegExp(keyword, isCaseSensitive ? 'g' : 'gi');
    } else {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(escaped, isCaseSensitive ? 'g' : 'gi');
    }
  } catch {
    return null;
  }

  lines.forEach((line, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      const trimmed = line.trim();
      matches.push({
        lineNumber: index + 1,
        content: trimmed.length > 200 ? trimmed.slice(0, 200) + '...' : trimmed,
      });
    }
  });

  return matches.length > 0 ? matches : null;
}

function fuzzyMatchFiles(files, keyword) {
  const lowerKeyword = keyword.toLowerCase();
  const words = lowerKeyword.split(/\s+/).filter(Boolean);

  return files.filter((f) => {
    const name = path.basename(f).toLowerCase();
    return words.every((w) => name.includes(w));
  });
}

// GET /api/config - return current workspace path
app.get('/api/config', (req, res) => {
  const workspacePath = req.query.path || path.join(__dirname, '..', 'workspace');
  res.json({ workspacePath: path.resolve(workspacePath) });
});

// POST /api/search
app.post('/api/search', (req, res) => {
  const {
    keyword,
    workspacePath,
    searchMode = 'content',
    isRegex = false,
    isCaseSensitive = false,
    maxResults = 200,
  } = req.body;

  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: '请输入搜索关键词' });
  }

  const targetPath = workspacePath
    ? path.resolve(workspacePath)
    : path.resolve(path.join(__dirname, '..', 'workspace'));

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: `目录不存在: ${targetPath}` });
  }

  const startTime = Date.now();
  const allFiles = collectFiles(targetPath);
  const results = [];

  if (searchMode === 'filename') {
    const matched = fuzzyMatchFiles(allFiles, keyword.trim());
    for (const f of matched.slice(0, maxResults)) {
      results.push({
        file: f,
        relativePath: path.relative(targetPath, f),
        matches: [],
        type: 'filename',
      });
    }
  } else {
    for (const file of allFiles) {
      if (results.length >= maxResults) break;
      const matches = searchInFile(file, keyword.trim(), isRegex, isCaseSensitive);
      if (matches) {
        results.push({
          file,
          relativePath: path.relative(targetPath, file),
          matches,
          type: 'content',
        });
      }
    }
  }

  const elapsed = Date.now() - startTime;

  res.json({
    keyword,
    workspacePath: targetPath,
    totalFiles: allFiles.length,
    resultCount: results.length,
    elapsed,
    results,
  });
});

// GET /api/browse - list directories for path picker
app.get('/api/browse', (req, res) => {
  const dir = req.query.dir || path.join(__dirname, '..');
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
      }));
    res.json({ current: dir, dirs });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔍 Code Search 启动成功`);
  console.log(`   访问地址: http://localhost:${PORT}`);
  console.log(`   默认搜索目录: ${path.resolve(path.join(__dirname, '..', 'workspace'))}\n`);
});
