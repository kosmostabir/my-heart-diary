import React from "react";
import {Link} from "react-router-dom";

export default function Header() {
    return (
        <div id="header">
            <nav>
                <Link to="/memories">Memories</Link>
                <Link to="/about">About</Link>
            </nav>
            <div id="login">
                <script async src="https://telegram.org/js/telegram-widget.js?16"
                        data-telegram-login="DPro_test_bot"
                        data-size="large" data-onauth="onTelegramAuth(user)"/>
            </div>
        </div>
    );
}
