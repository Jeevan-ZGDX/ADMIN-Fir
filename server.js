const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.get('/', (req, res) => res.json({ ok: true, msg: 'De-FIR backend running' }));

app.post('/fir/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const fileBuffer = fs.readFileSync(req.file.path);
    const firId = 'FIR-' + Date.now();
    
    // Generate IPFS hash using SHA-256
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    // Create a mock IPFS CIDv0 hash (Qm + base58 of sha256)
    const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const hashBuffer = Buffer.from('1220' + sha256Hash, 'hex');
    
    let cidHash = '';
    let num = 0n;
    for (let i = 0; i < hashBuffer.length; i++) {
      num = num * 256n + BigInt(hashBuffer[i]);
    }
    
    while (num > 0n) {
      cidHash = base58Alphabet[Number(num % 58n)] + cidHash;
      num = num / 58n;
    }
    
    const ipfsHash = cidHash || ('QmLocal' + sha256Hash.substring(0, 50));
    
    // Generate transaction hash
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');

    console.log('File uploaded -> IPFS Hash:', ipfsHash, 'TX Hash:', txHash);

    // Persist log entry to backend/logs.json
    const LOG_FILE = path.join(__dirname, 'logs.json');
    let logs = [];
    try {
      if (fs.existsSync(LOG_FILE)) {
        const raw = fs.readFileSync(LOG_FILE, 'utf8');
        logs = raw ? JSON.parse(raw) : [];
      }
    } catch (err) {
      console.error('Failed to read logs file:', err);
      logs = [];
    }

    const entry = {
      firId,
      ipfsHash,
      txHash,
      victim: req.body.victim || null,
      timestamp: new Date().toISOString(),
      gatewayUrl: `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
      filePath: req.file.path,
      fileName: req.file.filename,
      caseStatus: 'open', // open, in-progress, under-evaluation, concluded
      evidence: [
        {
          evidenceId: crypto.randomBytes(8).toString('hex'),
          ipfsHash,
          fileName: req.file.filename,
          uploadedAt: new Date().toISOString(),
          type: 'audio' // audio, document, image, etc.
        }
      ],
      timeline: [
        {
          timestamp: new Date().toISOString(),
          status: 'open',
          note: 'FIR case opened with initial evidence',
          evidenceCount: 1
        }
      ]
    };

    logs.unshift(entry); // newest first
    try {
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write logs file:', err);
    }

    return res.json({ 
      firId, 
      ipfsHash, 
      txHash,
      gatewayUrl: `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'internal', message: err.message });
  }
});

// Return stored FIR logs
app.get('/fir/logs', (req, res) => {
  const LOG_FILE = path.join(__dirname, 'logs.json');
  try {
    if (!fs.existsSync(LOG_FILE)) return res.json([]);
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const logs = raw ? JSON.parse(raw) : [];
    return res.json(logs);
  } catch (err) {
    console.error('Failed to read logs:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Update case status
app.post('/fir/case/:firId/status', (req, res) => {
  const { firId } = req.params;
  const { status, note } = req.body;

  const LOG_FILE = path.join(__dirname, 'logs.json');
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      logs = raw ? JSON.parse(raw) : [];
    }

    const caseIndex = logs.findIndex(log => log.firId === firId);
    if (caseIndex === -1) {
      return res.status(404).json({ error: 'FIR not found' });
    }

    logs[caseIndex].caseStatus = status;
    
    if (!logs[caseIndex].timeline) {
      logs[caseIndex].timeline = [];
    }

    logs[caseIndex].timeline.push({
      timestamp: new Date().toISOString(),
      status,
      note: note || `Case status updated to ${status}`,
      evidenceCount: logs[caseIndex].evidence?.length || 0
    });

    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
    
    return res.json({ 
      success: true, 
      message: 'Case status updated',
      caseStatus: status,
      timeline: logs[caseIndex].timeline
    });
  } catch (err) {
    console.error('Status update error:', err);
    return res.status(500).json({ error: 'internal', message: err.message });
  }
});

// Add evidence to existing case
app.post('/fir/case/:firId/evidence', upload.single('file'), (req, res) => {
  const { firId } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const LOG_FILE = path.join(__dirname, 'logs.json');
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      logs = raw ? JSON.parse(raw) : [];
    }

    const caseIndex = logs.findIndex(log => log.firId === firId);
    if (caseIndex === -1) {
      return res.status(404).json({ error: 'FIR not found' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const hashBuffer = Buffer.from('1220' + sha256Hash, 'hex');
    
    let cidHash = '';
    let num = 0n;
    for (let i = 0; i < hashBuffer.length; i++) {
      num = num * 256n + BigInt(hashBuffer[i]);
    }
    while (num > 0n) {
      cidHash = base58Alphabet[Number(num % 58n)] + cidHash;
      num = num / 58n;
    }
    
    const ipfsHash = cidHash || ('QmLocal' + sha256Hash.substring(0, 50));

    const newEvidence = {
      evidenceId: crypto.randomBytes(8).toString('hex'),
      ipfsHash,
      fileName: req.file.filename,
      uploadedAt: new Date().toISOString(),
      type: req.body.type || 'document',
      description: req.body.description || ''
    };

    if (!logs[caseIndex].evidence) {
      logs[caseIndex].evidence = [];
    }
    logs[caseIndex].evidence.push(newEvidence);

    if (!logs[caseIndex].timeline) {
      logs[caseIndex].timeline = [];
    }
    logs[caseIndex].timeline.push({
      timestamp: new Date().toISOString(),
      status: logs[caseIndex].caseStatus,
      note: `New evidence added: ${req.file.filename}`,
      evidenceCount: logs[caseIndex].evidence.length
    });

    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');

    return res.json({
      success: true,
      message: 'Evidence added successfully',
      evidence: newEvidence
    });
  } catch (err) {
    console.error('Evidence upload error:', err);
    return res.status(500).json({ error: 'internal', message: err.message });
  }
});

// Get case details including evidence and timeline
app.get('/fir/case/:firId', (req, res) => {
  const { firId } = req.params;
  const LOG_FILE = path.join(__dirname, 'logs.json');

  try {
    if (!fs.existsSync(LOG_FILE)) return res.status(404).json({ error: 'FIR not found' });
    
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const logs = raw ? JSON.parse(raw) : [];
    
    const caseData = logs.find(log => log.firId === firId);
    if (!caseData) {
      return res.status(404).json({ error: 'FIR not found' });
    }

    return res.json(caseData);
  } catch (err) {
    console.error('Failed to read case:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`De-FIR backend listening on port ${PORT}`));
