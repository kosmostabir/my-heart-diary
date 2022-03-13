import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import About from "./about";
import Memories from "./memories";

ReactDOM.render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App/>}/>
            <Route path="/about" element={<About/>}/>
            <Route path="/memories" element={<Memories/>}/>
        </Routes>
    </BrowserRouter>,
    document.getElementById("root")
);
