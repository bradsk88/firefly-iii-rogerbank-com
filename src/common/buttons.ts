function addLocationObserver(callback: () => void, subtree=false) {
    // Options for the observer (which mutations to observe)
    const config = {attributes: false, childList: true, subtree: subtree}

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback)

    // Start observing the target node for configured mutations
    observer.observe(document.body, config)
}

let lastUrl: string;

export function runOnURLMatch(
    urlPath: string,
    checkButtonExists: () => boolean,
    addButton: () => void,
): void {
    let callback = () => {
        if (checkButtonExists()) {
            return;
        }
        let curUrl = window.location.href.split('?')[0];
        if (curUrl !== lastUrl && curUrl.endsWith(urlPath)) {
            addButton();
            lastUrl = curUrl;
        }
    };
    addLocationObserver(callback);
    callback();
}

// TODO: Add to base project
export function runOnContentChange(
    urlPath: string,
    func: () => void,
): void {
    let callback = () => {
        let curUrl = window.location.href.split('?')[0];
        if (curUrl.endsWith(urlPath)) {
            func();
        }
    };
    addLocationObserver(callback, true);
    callback();
}