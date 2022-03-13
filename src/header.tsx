import React from "react";
import {Link} from "react-router-dom";
import TelegramLoginButton from 'react-telegram-login';

export default function Header() {
    return (
        <div id="header">
            <nav>
                <Link to="/memories">Memories</Link>
                <Link to="/about">About</Link>
            </nav>
            <TelegramLoginButton
                dataOnauth={authData => document.cookie = "authToken=" + encodeURIComponent(JSON.stringify(authData)) + ";path=/"}
                botName="DPro_test_bot" buttonSize='medium'/>
        </div>
    );
}
