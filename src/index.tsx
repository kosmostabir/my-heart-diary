import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import About from "./about";
import Memories from "./memories";
import Users from "./users";

ReactDOM.render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App/>}/>
            <Route path="/about" element={<About/>}/>
            <Route path="/memories" element={<Memories/>}/>
            <Route path="/users" element={<Users/>}/>
        </Routes>
    </BrowserRouter>,
    document.getElementById("root")
);
