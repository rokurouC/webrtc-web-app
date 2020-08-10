import React, { Component } from 'react';
import { FirebaseRepo } from '../../repo'

export class RoomList extends Component {
    constructor(props) {
        super(props);
        /**
         * @type {(roomId:string) => void
         */
        this.onJoinRoom = props.onJoinRoom;
        this.state = {
            /**
             * @type {{ roomName: string, roomId: string }[]}
             */
            list: []
        }
        this.firebaseRepo = FirebaseRepo.sharedInstance();
    }

    componentDidMount = () => {
        this.firebaseRepo.listenRooms((list) => {
            this.setState({ list });
        })
    }

    renderList = () => [
        this.state.list.map((list) => {
            return (
                <div key={list.roomId} style={styles.row}>
                    <span>{list.roomName}</span>
                    <button style={styles.button} onClick={() => {
                        this.onJoinRoom && this.onJoinRoom(list.roomId);
                    }}>Join</button>
                </div>
            )
        })
    ]

    render() {
        return (
            <React.Fragment>
                <div>
                    <span style={styles.title}>{'Now active rooms:'}</span>
                </div>
                <div style={styles.listContainer}>
                    {this.renderList()}
                </div>
            </React.Fragment>
        )
    }
}

const styles = {
    button: {
        marginLeft: 5
    },
    title: {
        color: 'blue',
        fontWeight: 'bold'
    },
    listContainer: {
        marginTop: 10
    },
    row: {
        justifyContent: 'center',
        height: 30
    }
}