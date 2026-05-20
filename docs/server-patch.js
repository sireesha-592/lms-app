// ─────────────────────────────────────────────────────────────────────────────
//  PATCH: Replace the CORS and listen sections of your existing server.js
//
//  WHY: When running inside Electron, the React app is loaded as a file://
//  URL, not http://localhost:3000. We need to allow that origin too.
//  Also the PORT should come from the environment so Electron can set it.
// ─────────────────────────────────────────────────────────────────────────────

// ── REPLACE your existing CORS config with this: ─────────────────────────────
//
//   BEFORE:
//     app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
//
//   AFTER (paste this):

const ALLOWED_ORIGINS = [
  'http://localhost:3000',          // React dev server
  'http://localhost:5000',          // Same-origin API calls from built app
  'file://',                        // Electron production (file:// pages)
  null,                             // Some Electron builds send null origin
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (curl, Electron, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

// ── REPLACE your listen call with this: ───────────────────────────────────────
//
//   BEFORE:
//     server.listen(5000, () => console.log('Server running on port 5000'));
//
//   AFTER:

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ── Also update Socket.IO CORS: ───────────────────────────────────────────────
//
//   BEFORE:
//     const io = new Server(server, {
//       cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'], credentials: true }
//     });
//
//   AFTER:
//
//     const io = new Server(server, {
//       cors: {
//         origin: (origin, cb) => {
//           if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
//           cb(new Error('socket CORS'));
//         },
//         methods: ['GET', 'POST'],
//         credentials: true,
//       }
//     });
