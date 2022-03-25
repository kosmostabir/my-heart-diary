import React from "react";
import "./styles.css";
import {User} from "./models";
import Header from "./header";
import {getConsentedUsers} from "./api";
import {DataGrid} from '@mui/x-data-grid';
import {Link} from "react-router-dom";

interface UsersComponentState {
    users: Array<User & { lastMemory: number, totalMemories: number }>;
    error: string;
}

export default class Users extends React.Component<{}, UsersComponentState> {
    state = {
        users: undefined,
        error: undefined,
    };

    componentDidMount() {
        getConsentedUsers().then(response => this.setState({users: response.data || []}))
            .catch((e) => this.setState({error: e.response?.status === 403 ? "Unauthorized" : "Error"}))
    }

    render() {
        const {users, error} = this.state as UsersComponentState;
        return (
            <>
                <Header/>
                {error
                    ? <div className="error">{error}</div>
                    : users
                        ?
                        <DataGrid
                            getRowId={row => row.userId}
                            rows={users}
                            columns={[
                                {
                                    renderCell: (params) => <Link
                                        to={'/memories?user=' + params.row.userId}>{params.value}</Link>,
                                    field: 'name',
                                    width: 200,
                                },
                                {
                                    field: 'lastmemory',
                                    renderCell: (params => params.value ? new Date(params.value * 1000).toLocaleString() : '-'),
                                    headerName: 'Останній спогад',
                                    width: 200,
                                },
                                {
                                    field: 'totalmemories',
                                    headerName: "Всього спогадів",
                                    type: "number",
                                    renderCell: params => params.row.lastmemory ? params.value : 0,
                                    width: 150
                                }
                            ]}
                        />
                        : <div className="error">Loading...</div>
                }
            </>
        );
    }
}
