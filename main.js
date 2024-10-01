// Import the functions you need from the SDKs you need
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, getDoc,setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
// https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
    const firebaseConfig = {
        apiKey: "AIzaSyCRP8A2Ebh9-RBzmKNLpDJjT6t264ZJvl0",
        authDomain: "videocallingapp-b1b3a.firebaseapp.com",
        databaseURL: "https://videocallingapp-b1b3a-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "videocallingapp-b1b3a",
        storageBucket: "videocallingapp-b1b3a.appspot.com",
        messagingSenderId: "83663073066",
        appId: "1:83663073066:web:2fcdced5fcfa71b21bb853",
        measurementId: "G-QZY34NS33J"
      };

    // Initialize Firebase
    const firebase = initializeApp(firebaseConfig);
    const db = getFirestore(firebase);
    const analytics = getAnalytics(firebase);


const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let pc = null;
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');

const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');

const answerButton = document.getElementById('answerButton');
const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources
webcamButton.onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(
            {
                audio:true,
                video:true,
            }
        );
        localStream = stream;
      } 
      catch (error) {
          console.error("Error accessing media devices:", error);
        }

      remoteStream = new MediaStream();

     //Initialize peer connection
      pc = new RTCPeerConnection(servers);

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer by calling...
callButton.onclick = async () => {
  // Reference Firestore collections for signaling
  const callDoc = doc(collection(db, 'calls'));
  const offerCandidates = collection(callDoc, 'offerCandidates');
  const answerCandidates = collection(callDoc, 'answerCandidates');

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await setDoc(callDoc, { offer });

  // Listen for remote answer
  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = doc( collection(db, 'calls'), callId );
  const answerCandidates = collection(callDoc, 'answerCandidates');
  const offerCandidates =  collection(callDoc, 'offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && addDoc( answerCandidates, event.candidate.toJSON() );
  };
  
  const callDocSnap = await getDoc(callDoc);
  const callData = callDocSnap.data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await updateDoc(callDoc, { answer });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};

// 4. Hangup call
hangupButton.onclick = () => {
    
    if(pc)
{
      pc.close();
      pc = null;
}
    localStream.getTracks().forEach(
         item => {
            item.stop();
    }
  );
    remoteStream.getTracks().forEach((track) => track.stop());
    
    webcamVideo.srcObject = null;
    remoteVideo.srcObject = null;

    hangupButton.disabled = true;
    webcamButton.disabled = false;
}