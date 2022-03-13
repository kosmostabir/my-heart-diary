import React from "react";
import axios from "axios";
import "./styles.css";
import Header from "./header";

export default class App extends React.Component {
    state = {
        users: [],
    };

    componentDidMount() {
        axios.get("/users.json").then((response) => {
            this.setState({users: response.data});
        });
    }

    render() {
        const {users} = this.state;
        return (
            <main>
                <Header/>
                <ul className="users">
                    {users.map((user) => (
                        <li className="user">
                            <p>
                                <strong>Name:</strong> {user.name}
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
            </main>
        );
    }
}
