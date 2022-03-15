import React from "react";
import {Link} from "react-router-dom";
import TelegramLoginButton from 'react-telegram-login';

export default function Header() {
    const role = JSON.parse(decodeURIComponent(document.cookie.match(new RegExp('role=([^;]+)'))[1]));
    return (
        <div id="header">
            <nav>
                <Link to="/memories">Спогади</Link>
                <a href="https://youcantellme.notion.site/fc93ec4ebf154f7c821b845f72067694">Про проект</a>
                {role && <a href="/send">Написати</a> }
                <TelegramLoginButton
                    dataOnauth={authData => document.cookie = "authToken=" + encodeURIComponent(JSON.stringify(authData)) + ";path=/"}
                    botName="DPro_test_bot" buttonSize='small'/>
            </nav>
        </div>
    );
}
