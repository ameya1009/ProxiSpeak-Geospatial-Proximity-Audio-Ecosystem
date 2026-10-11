# Open Items & Mentor Confirmation Document
**Group**: Group 15  
**Project**: ProxiSpeak: Geospatial Proximity Audio Ecosystem  
**Target Review Slots**: Mid Review: 26/27 Oct 2026 | Final Review: 9/10 Nov 2026  

---

## Questions for Project Mentor (Infotact Solutions)

1. **20 ms Latency Metric Clarification**:
   - *Question*: What exactly does the Mid-Review 20 ms target benchmark? Does it measure the raw MongoDB geospatial query execution time alone, or the end-to-end WebSocket round-trip (client movement event -> server spatial calculation -> `peer:enter`/`peer:leave` broadcast)?
   - *Our Assumption*: Milind benchmarks MongoDB `$near` query execution time under 15 ms, giving a total end-to-end event latency budget of <20 ms.

2. **World Dimensions and Coordinates**:
   - *Question*: What are the standard virtual office world boundaries (e.g., 2000px × 2000px, or 1920px × 1080px)? Are coordinates purely integers in Euclidean pixels, or float values? Is a formal login required or does a simple avatar nickname prompt suffice?
   - *Our Assumption*: Bounded 2000px × 2000px coordinate system in positive integer pixels with a simple nickname login.

3. **Maximum Peer Capacity & WebRTC Mesh Architecture**:
   - *Question*: Given full mesh WebRTC scaling limits (\(O(N^2)\) peer connections), what is the maximum simultaneous audio peer connection cap \(N\) per client? Is a public TURN server provided by Infotact, or are standard public STUN servers (`stun:stun.l.google.com:19302`) sufficient for the evaluation environment?
   - *Our Assumption*: Cap \(N = 6\) nearest active peers; public Google STUN for NAT traversal.

4. **AI-Assisted Code Policy & Disclosure**:
   - *Question*: What is the mentor's explicit policy regarding AI-assisted code generation, scaffolding, and disclosure documentation?
   - *Our Policy*: All architecture, algorithms, and implementations are fully understood, documented with evidence, and prepared for deep individual viva examination.

5. **Review Slot Selection**:
   - *Request*: Confirming Group 15 requests the late review slots:
     - **Mid Review**: 27 October 2026
     - **Final Review**: 10 November 2026
