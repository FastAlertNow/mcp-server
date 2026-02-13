export const respond = (response: any) => {
    const { status, message, data } = response;
    
    let formattedText: string;
    
    if (data === undefined || data === null) {
        formattedText = JSON.stringify({ status, message }, null, 2);
    } else if (Array.isArray(data)) {
        const items = data.map((item) => JSON.stringify(item, null, 2)).join('\n');
        formattedText = JSON.stringify({ status, message }, null, 2) + '\n\nData:\n' + items;
    } else {
        formattedText = JSON.stringify({ status, message, data }, null, 2);
    }

    return {
        content: [{ type: "text", text: formattedText }],
    };
};

export const respondError = (err: unknown) => ({
    content: [
        {
            type: "text",
            text: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
        },
    ],
    isError: true,
});
