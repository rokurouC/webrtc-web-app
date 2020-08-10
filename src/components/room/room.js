import React from 'react';
import { FirebaseRepo } from '../../repo/firebaseRepo';
import { RoomList } from './roomList';

export class Room extends React.Component {
    constructor(props) {
        super(props);
        /**
         * @type {MediaStreamConstraints}
         */
        this.constraints = { video: true, audio: true, };
        /**
         * @type {React.RefObject<HTMLVideoElement>}
         */
        this.localVideoRef = React.createRef();
        /**
         * @type {React.RefObject<HTMLVideoElement>}
         */
        this.remoteVideoRef = React.createRef();
        /**
         * @type {MediaStream}
         */
        this.localStream = undefined;
        /**
         * @type {{ 
         * roomName: string, 
         * roomId: string, 
         * peerConnection: RTCPeerConnection,
         * role: 'offer' | 'answer'
         * }}
         */
        this.room = undefined

        this.firebaseRepo = FirebaseRepo.sharedInstance();

        this.state = {
            hintText: '☕️ Create or join a room.',
            connected: false
        }
    }

    componentDidMount() {
        this.setupLocalVideo();
    }

    setupLocalVideo = () => {
        navigator.mediaDevices.getUserMedia(this.constraints)
        .then(stream => {
            this.localVideoRef.current.srcObject = stream;
            this.localStream = stream;
        })
        .catch(() => {
            console.log(`get user media failed.`);
        })
    }

    /**
     * create room
     */
    createRoom = () => {
        const enteredName = prompt(`Please provide the name of room:`, `Let's rolo!`);
        if (enteredName === null) { 
            return; 
        }
        if (enteredName === '') { 
            alert('The name of the room must be provided.');
            return;
        }
        this.firebaseRepo.createRoomWithName(
            enteredName,
            this.localStream,
            (roomInfo) => {
                this.room = roomInfo;
                this.setState({
                    hintText: `💬 Let's chat!`,
                    connected: true
                })
            },
            (track) => {
                this.remoteVideoRef.current.srcObject = track;
            },
            () => {

            }
        )
    }

    /**
     * join room
     * @param {string} roomId 
     */
    joinRoom = (roomId) => {
        if (this.state.connected) {
            const msg = this.room.roomId === roomId ? `You're already in the room.` : `You're in a chat room now, please leave first.`;
            alert(msg);
            return;
        }
        this.firebaseRepo.joinRoomById(
            roomId, 
            this.localStream,
            (roomInfo) => {
                this.room = roomInfo;
                this.setState({
                    hintText: `Let's chat!`,
                    connected: true
                })
            },
            (track) => {
                this.remoteVideoRef.current.srcObject = track;
            },
            () => {
                this.room = undefined;
                this.setState({
                    hintText: '☕️ Create or join a room.',
                    connected: false
                })
            }
        )
    }

    leaveRoom = () => {
        this.firebaseRepo.leaveRoom(
            this.room, 
            () => {
                this.room = undefined;
                this.setState({
                    hintText: '☕️ Create or join a room.',
                    connected: false
                })
            })
    }

    renderButton = () => {
        return this.state.connected ? 
        (
            <button 
                onClick={this.leaveRoom}
                style={styles.button}
            >Leave Room</button>
        ) : 
        (
            <button 
                onClick={this.createRoom}
                style={styles.button}
            >Create Room</button>
        )
    }

    render() {
        return (
            <div>
                <video
                    style={{
                    width: 240,
                    height: 240,
                    margin: 5,
                    backgroundColor: 'black'
                    }}
                    ref={ this.localVideoRef }
                    autoPlay>
                </video>
                <video
                    style={{
                    width: 240,
                    height: 240,
                    margin: 5,
                    backgroundColor: 'black'
                    }}
                    ref={ this.remoteVideoRef }
                    autoPlay>
                </video>
                {/* Below the video */}
                <div style={styles.bottomArea}>
                    <div style={styles.hintTextArea}>
                        <span>{this.state.hintText}</span>
                    </div>
                    {this.renderButton()}
                    <div style={styles.roomList}>
                        <RoomList onJoinRoom={this.joinRoom} />
                    </div>
                </div>
            </div>
        )
    }
}

const styles = {
    bottomArea: {
        marginLeft: 4
    },
    hintTextArea: {

    },
    button: {
        marginTop: 10
    },
    roomList: {
        marginTop: 10
    }
}
