import React from "react";
import "./styles.css";
import {Link} from "react-router-dom";
import axios from "axios";

export default class Memories extends React.Component {
    state = {
        memories: [],
    };

    componentDidMount() {
        axios("/api/memories")
            .then(response => this.setState({memories: response.data}));
    }

    render() {
        const {memories} = this.state;
        return (
            <div>
                <nav>
                    <Link to="/about">About</Link>
                    <Link to="/memories">Memories</Link>
                </nav>
                <ul className="users">
                    {memories.map((user) => (
                        <li className="user">
                            <p>
                                <strong>Name:</strong> {user.text}
                            </p>
                            <p>
                                <strong>Email:</strong> {user.email}
                            </p>
                            <p>
                                <strong>City:</strong> {user.address.city}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}
