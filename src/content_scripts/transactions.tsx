import {TransactionStore} from "firefly-iii-typescript-sdk-fetch";
import {runOnURLMatch} from "../common/buttons";
import {AutoRunState} from "../background/auto_state";
import {getCurrentPageAccount, scrapeTransactionsFromPage} from "./scrape/transactions";
import {PageAccount} from "../common/accounts";

// TODO: You will need to update manifest.json so this file will be loaded on
//  the correct URL.

interface TransactionScrape {
    pageAccount: PageAccount;
    pageTransactions: TransactionStore[];
}

async function doScrape(): Promise<TransactionScrape> {
    const accounts = await chrome.runtime.sendMessage({
        action: "list_accounts",
    });
    const id = await getCurrentPageAccount(accounts);
    const txs = scrapeTransactionsFromPage(id.id);
    chrome.runtime.sendMessage({
            action: "store_transactions",
            value: txs,
        },
        () => {
        });
    return {
        pageAccount: id,
        pageTransactions: txs,
    };
}

const buttonId = 'firefly-iii-export-transactions-button';

function addButton() {
    // TODO: This is where you add a "scrape" button to the page where the
    //  account's transactions are listed.
    const button = document.createElement("button");
    button.textContent = "Export Transactions"
    button.addEventListener("click", async () => doScrape(), false);
    // TODO: Try to steal styling from the page to make this look good :)
    button.classList.add("some", "classes", "from", "the", "page");
    document.body.append(button);
}

function enableAutoRun() {
    chrome.runtime.sendMessage({
        action: "get_auto_run_state",
    }).then(state => {
        if (state === AutoRunState.Transactions) {
            doScrape()
                .then((id: TransactionScrape) => chrome.runtime.sendMessage({
                    action: "complete_auto_run_state",
                    state: AutoRunState.Transactions,
                }));
        }
    });
}

// If your manifest.json allows your content script to run on multiple pages,
// you can call this function more than once, or set the urlPath to "".
runOnURLMatch(
    'accounts/main/details', // TODO: Set this to your transactions page URL
    () => !!document.getElementById(buttonId),
    () => {
        addButton();
        enableAutoRun();
    },
)
