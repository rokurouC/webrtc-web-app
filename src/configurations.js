export const peerConnectionConfig = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
};

export const firebaseConfig = {
    apiKey: "AIzaSyBoAgZUk5hAG5iahISmTgANO0BJ7IlaRAE",
    authDomain: "web-rtc-rokurouc.firebaseapp.com",
    databaseURL: "https://web-rtc-rokurouc.firebaseio.com",
    projectId: "web-rtc-rokurouc",
    storageBucket: "web-rtc-rokurouc.appspot.com",
    messagingSenderId: "643814106878",
    appId: "1:643814106878:web:3c1809e2f099919141a7af",
    measurementId: "G-E0RGHVJKP1"
}