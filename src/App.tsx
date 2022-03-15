import React from "react";
import "./styles.css";
import Header from "./header";

export default class App extends React.Component {

    componentDidMount() {
    }

    render() {
        return (
            <>
                <Header/>
                <img style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} src='logo.png'/>
            </>
        );
    }
}
