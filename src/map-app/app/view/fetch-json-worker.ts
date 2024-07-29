self.onmessage = (e: MessageEvent<string>) => {
    fetch(e.data)
        .then((response) => response.json())
        .then((data) => {
            self.postMessage(data);
        })
        .catch((error) => {
            console.error('Error fetching JSON data:', error);
        });
}

export {};
