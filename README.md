# ProxiSpeak – Geospatial Proximity Audio Ecosystem

## 1. Project Overview

ProxiSpeak is a real-time geospatial proximity-based communication system designed to make virtual collaboration more natural. Users can move around a shared virtual environment and communicate with nearby users.

Unlike traditional meeting platforms, ProxiSpeak supports spatial interactions and real-time communication.

## 2. Key Features

- Real-time user movement tracking.
- Geospatial proximity detection.
- Virtual room management.
- Real-time communication using Socket.IO.
- WebRTC signaling for peer-to-peer communication.
- Redis adapter for scalable Socket.IO communication.

## 3. Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | Server framework |
| Socket.IO | Real-time communication |
| Redis | Socket.IO adapter |
| JavaScript | Backend development |
| WebRTC | Peer-to-peer signaling |

## 4. Project Structure

```text
ProxiSpeak-Geospatial-Proximity-Audio-Ecosystem/
│
├── backend/
│   ├── controllers/
│   │   └── userController.js
│   ├── middleware/
│   ├── models/
│   │   └── userLocations.js
│   ├── routes/
│   │   └── userRoutes.js
│   ├── server.js
│   ├── test-client.js
│   ├── package.json
│   └── .env
│
└── README.md
```

## 5. Installation

Clone or download the project repository.

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables in the backend `.env` file according to the server configuration.

Ensure Redis is running and accessible.

## 6. Start the Backend Server

Run:

```bash
npm start
```

The server should start on the configured port.

## 7. Run Integration Tests

Run:

```bash
npm test
```

The integration test checks:

- Connection between two clients.
- Joining the same room.
- Real-time movement updates.
- WebRTC offer relay.

## 8. Testing Results

The following integration checks were successfully executed:

- Both clients connected.
- Both users joined main-hall.
- Real-time movement received.
- WebRTC offer relayed.

**Result: All integration checks passed.**

## 9. Project Objective

The objective of ProxiSpeak is to develop a proximity-based communication platform that enables natural interactions in virtual collaborative environments.

## 10. Future Enhancements

- Spatial audio implementation.
- User authentication.
- Improved room management.
- Frontend integration.
- Production deployment and scalability improvements.