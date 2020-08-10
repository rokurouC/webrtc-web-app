import app from 'firebase/app';
import 'firebase/firestore';
import { firebaseConfig } from '../configurations';
import { peerConnectionConfig } from '../configurations';

/**
 * @type {FirebaseRepo}
 */
let sharedInstance = undefined;

export class FirebaseRepo {
    constructor() {
        app.initializeApp(firebaseConfig);
        this.db = app.firestore();
        /**
         * @type {() => void}
         */
        this.listenCallerCandidatesUnsubscribe = undefined;
        /**
         * @type {() => void}
         */
        this.listenAnswerUnsubscribe = undefined;
        /**
         * @type {() => void}
         */
        this.listenCalleeCandidatesUnsubscribe = undefined;
    }

    static init = () => {
        if (!sharedInstance) {
            sharedInstance = new FirebaseRepo();
        }
    }

    static sharedInstance = () => {
        if (!sharedInstance) {
            sharedInstance = new FirebaseRepo();
        }
        return sharedInstance;
    }

    /**
     * @param {(list: { roomName: string, roomId: string }[]) => void} onListChange 
     */
    listenRooms = (onListChange) => {
        this.db.collection('rooms').onSnapshot(snapshot => {
            const roomInfoList = snapshot.docs.map(doc=> {
                const data = doc.data();
                return {
                    roomId: data.roomId,
                    roomName: data.roomName,
                }
            });
            onListChange(roomInfoList);
        })
    }

    /**
     * @param {string} roomName
     * @param {MediaStream} localStream
     * @param {(info: { 
     * roomName: string, 
     * roomId: string, 
     * peerConnection: RTCPeerConnection, 
     * role: 'offer' | 'answer' }) => void} successWithRoomInfo
     * @param {(track: MediaStream) => void} onRemoteTrackGet
     * @param {() => void} onRemoteLeave
     * 
     */
    createRoomWithName = async (roomName, localStream, successWithRoomInfo, onRemoteTrackGet, onRemoteLeave) => {
        //create a unique id for room
        const roomRef = this.db.collection('rooms').doc();
        //create a collection for ICE candidates
        const callerCandidatesCollection = roomRef.collection('callerCandidates');
        const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
        //create and config peer connection
        /**
         * @type {RTCPeerConnection}
         */
        let peerConnection = undefined;

        const createPeerConnection = async () => {
            peerConnection = new RTCPeerConnection(peerConnectionConfig);

            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            peerConnection.onicecandidate = (e) => {
                if (!e.candidate) {
                    console.log('Got final candidate!');
                    return;
                }
                console.log('Got candidate: ', e.candidate);
                callerCandidatesCollection.add(e.candidate.toJSON());
            }

            peerConnection.ontrack = (e) => {
                console.log('Got remote track:', e.streams[0]);
                onRemoteTrackGet(e.streams[0]);
            }

            peerConnection.onconnectionstatechange = (e) => {
                console.log('Connection state change:');
                console.log(e.currentTarget);
                if (e.currentTarget.connectionState === 'disconnected') {
                    peerConnection.close();
                    peerConnection = undefined;
                    createPeerConnection();
                }
            }

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log('Created offer:', offer);
            const roomId = roomRef.id;

            const roomWithOffer = {
                roomName,
                roomId,
                offer: {
                  type: offer.type,
                  sdp: offer.sdp,
                },
            };

            await roomRef.set(roomWithOffer);
            console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);
            successWithRoomInfo({
                roomName,
                roomId,
                peerConnection,
                role: 'offer'
            })

            // Listening for remote sdp
            this.listenAnswerUnsubscribe = roomRef.onSnapshot(async snapshot => {
                const data = snapshot.data();
                if (!peerConnection.currentRemoteDescription && data && data.answer) {
                    console.log('Got remote description: ', data.answer);
                    const rtcSDP = new RTCSessionDescription(data.answer);
                    await peerConnection.setRemoteDescription(rtcSDP);
                }
            })
            // Listen for remote ICE candidates
            this.listenCalleeCandidatesUnsubscribe = calleeCandidatesCollection.onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                    if (peerConnection.currentRemoteDescription) {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                    }
                }
                });
            });
        }
        createPeerConnection();
    }

    /**
     * @param {string} roomId
     * @param {MediaStream} localStream
     * @param {(info: { 
     * roomName: string, 
     * roomId: string, 
     * peerConnection: 
     * RTCPeerConnection, role: 'offer' | 'answer' }) => void} successWithRoomInfo
     * @param {(track: MediaStream) => void} onRemoteTrackGet
     * @param {() => void} onHostLeave
     */
    joinRoomById = async (roomId, localStream, successWithRoomInfo, onRemoteTrackGet, onHostLeave) => {
        const roomRef = this.db.collection('rooms').doc(`${roomId}`);
        const roomSnapshot = await roomRef.get();
        if (roomSnapshot.exists) {
            //create and config peer connection
            /**
             * @type {RTCPeerConnection}
             */
            let peerConnection = undefined;
            peerConnection = new RTCPeerConnection(peerConnectionConfig);
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            const callerCandidatesCollection = roomRef.collection('callerCandidates');
            const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
             // listening for remote ICE candidates
            this.listenCallerCandidatesUnsubscribe = callerCandidatesCollection.onSnapshot(snapshot => {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
                        if (peerConnection.currentRemoteDescription && peerConnection.signalingState !== 'closed') {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
                        }
                    }
                });
            });

            peerConnection.onicecandidate = (e) => {
                if (!e.candidate) {
                    console.log('Got final candidate!');
                    return;
                }
                console.log('Got candidate: ', e.candidate);
                calleeCandidatesCollection.add(e.candidate.toJSON());
            }
            
            peerConnection.ontrack = (e) => {
                console.log('Got remote track:', e.streams[0]);
                onRemoteTrackGet(e.streams[0]);
            }

            peerConnection.onconnectionstatechange = (e) => {
                console.log('Connection state change:');
                console.log(e.currentTarget);
                if (e.currentTarget.connectionState === 'disconnected') {
                    if (this.listenCallerCandidatesUnsubscribe) {
                        this.listenCallerCandidatesUnsubscribe();
                        this.listenCallerCandidatesUnsubscribe = undefined;
                    }
                    peerConnection.close();
                    peerConnection = undefined;
                    onHostLeave();
                }
            }

            const offer = roomSnapshot.data().offer;
            const roomName = roomSnapshot.data().roomName;
            console.log('Got offer:', offer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            console.log('Created answer:', answer);
            await peerConnection.setLocalDescription(answer);
            const roomWithAnswer = {
                answer: {
                  type: answer.type,
                  sdp: answer.sdp,
                },
            };
            await roomRef.update(roomWithAnswer);
            successWithRoomInfo({
                roomName,
                roomId,
                peerConnection,
                role: 'answer'
            })
        }
    }

    /**
     * @param {{ 
     * roomName: string, 
     * roomId: string, 
     * peerConnection: RTCPeerConnection, 
     * role: 'offer' | 'answer'
     * }} room
     * @param {() => void} success
     */
    leaveRoom = async (room, success) => {
        const roomRef = this.db.collection('rooms').doc(room.roomId);
        if (room.role === 'answer') {
            const calleeCandidates = await roomRef.collection('calleeCandidates').get();
            calleeCandidates.forEach(async candidate => {
                await candidate.ref.delete();
            });
            roomRef.update({ answer: app.firestore.FieldValue.delete() });
            if (this.listenCallerCandidatesUnsubscribe) {
                this.listenCallerCandidatesUnsubscribe();
                this.listenCallerCandidatesUnsubscribe = undefined;
            }
            room.peerConnection.close();
            success();
        } else if (room.role === 'offer') {
            const calleeCandidates = await roomRef.collection('calleeCandidates').get();
            calleeCandidates.forEach(async candidate => {
                await candidate.ref.delete();
            });
            
            const callerCandidates = await roomRef.collection('callerCandidates').get();
            callerCandidates.forEach(async candidate => {
                await candidate.ref.delete();
            });
            await roomRef.delete();
            if (this.listenAnswerUnsubscribe) {
                this.listenAnswerUnsubscribe();
                this.listenAnswerUnsubscribe = undefined;
            }
            if (this.listenCalleeCandidatesUnsubscribe) {
                this.listenCalleeCandidatesUnsubscribe();
                this.listenCalleeCandidatesUnsubscribe = undefined;
            }
            room.peerConnection.close();
            success();
        } 
    }
}