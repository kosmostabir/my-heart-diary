import React from "react";

export class ImageComponent extends React.Component<{}, { expanded: boolean }> {
    state = {
        expanded: false,
    };

    render() {
        const {expanded} = this.state;
        return <div className={`expandable ${expanded ? 'expanded' : ''}`}
                    onClick={() => this.setState({expanded: !expanded})}>
            {this.props.children}
        </div>
    }
}
