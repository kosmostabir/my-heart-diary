import React from "react";
import "./styles.css";
import axios from "axios";
import {Memory, MemoryType} from "./models";
import Header from "./header";

export default class Memories extends React.Component {
    state = {
        memories: null,
        error: null,
    };

    componentDidMount() {
        axios("/api/memories")
            .then(response => this.setState({memories: response.data || []}))
            .catch(e => {
                if (e.response?.status === 403) {
                    this.setState({
                        error: <div className="error">Спробуй увійти через телеграм</div>
                    })
                } else if (e.response?.status === 404) {
                    this.setState({
                        error: <div className="error">Зареєструйся у чат-боті <a
                            href="https://t.me/you_can_tell_me_bot">You Can
                            Tell Me</a></div>
                    })
                }
            });
    }

    render() {
        const {memories, error} = this.state;
        return (
            <div>
                <Header/>
                {error
                    ? error
                    : <div className="memories">
                        {memories ?
                            memories.length
                                ? memories.map((memory) => renderMemory(memory))
                                : <div className="error">Спогадів ще немає</div>
                            : <div className="error">Loading...</div>
                        }
                    </div>
                }
            </div>
        );
    }
}

function renderMemory(memory: Memory) {
    if (memory.type === MemoryType.TEXT) {
        return <p className='memory'>
            {memory.text}
        </p>
    } else {
        switch (memory.type) {
            case MemoryType.VOICE:
            case MemoryType.AUDIO:
                return <p className='memory'>
                    <audio controls>
                        <source src={memory.url}/>
                    </audio>
                </p>
            case MemoryType.IMAGE:
                return <p className='memory'>
                    <img src={memory.url}/>
                </p>
            case MemoryType.VIDEO_NOTE:
            case MemoryType.VIDEO:
                return <p className='memory'>
                    <video controls>
                        <source src={memory.url}/>
                    </video>
                </p>
            case MemoryType.FILE:
                return <p className='memory'>
                    <a href={memory.url} download/>
                </p>
        }
    }
}
