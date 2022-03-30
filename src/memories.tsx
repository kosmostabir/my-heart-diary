import React from "react";
import "./styles.css";
import {Memory, MemoryType} from "./models";
import Header from "./header";
import {ImageComponent} from "./img";
import {getMemories} from "./api";

const fileTooBigErrorText = <div className='error'>Не вдалося отримати посилання на файл, можливо він завеликий</div>;

export default class Memories extends React.Component {
    state = {
        memories: null,
        error: null,
    };

    componentDidMount() {
        getMemories()
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
            <>
                <Header/>
                {error
                    ? error
                    : <div className="memories">
                        {memories ?
                            memories.length
                                ? groupMemoriesByDays(memories).map((day) => renderDay(day))
                                : <div className="error">Спогадів ще немає</div>
                            : <div className="error">Loading...</div>
                        }
                    </div>
                }
            </>
        );
    }
}

function groupMemoriesByDays(memories: Memory[]) {
    const days: Record<string, Array<Memory & { date: Date }>> = {};
    memories.forEach(memory => {
        const date = new Date(memory.timestamp * 1000);
        const dateTimestamp = new Date(date.toDateString()).getTime();
        if (!days[dateTimestamp]) {
            days[dateTimestamp] = [{...memory, date}];
        } else {
            days[dateTimestamp].push({...memory, date})
        }
    })
    return Object.keys(days).sort().map(dateTimestamp => new Date(Number(dateTimestamp))).map(date => [date, days[date.getTime()]] as const)
}

function renderDay([day, memories]: readonly [Date, Array<Memory & { date: Date }>]) {
    return <div className='day-container'>
        <div className='day'><span>{day.toDateString()}</span></div>
        {memories.map(memory => <div className='memory'>
            <div className='time'><span>{memory.date.toTimeString().slice(0, 9)}</span></div>
            {renderMemory(memory)}
        </div>)}
    </div>
}

function renderMemory(memory: Memory) {
    if (memory.type === MemoryType.TEXT) {
        return memory.text
    } else {
        switch (memory.type) {
            case MemoryType.VOICE:
            case MemoryType.AUDIO:
                return <>
                    {memory.url ? <audio controls>
                        <source src={memory.url}/>
                    </audio> : fileTooBigErrorText}
                    {memory.text}
                </>
            case MemoryType.IMAGE:
                return <>
                    <ImageComponent>
                        <img src={memory.url}/>
                    </ImageComponent>
                    {memory.text}
                </>
            case MemoryType.VIDEO_NOTE:
            case MemoryType.VIDEO:
                return <>
                    {memory.url ? <video controls>
                        <source src={memory.url}/>
                    </video> : fileTooBigErrorText
                    }
                    {memory.text}
                </>
            case MemoryType.FILE:
                return <>
                    {memory.url ? <a href={memory.url} download/> : fileTooBigErrorText}
                    {memory.text}
                </>
        }
    }
}
