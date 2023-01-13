import {TransactionStore} from "firefly-iii-typescript-sdk-fetch";
import {AutoRunState} from "../background/auto_state";
import {getCurrentPageAccount, scrapeTransactionsFromPage} from "./scrape/transactions";
import {PageAccount} from "../common/accounts";
import {runOnURLMatch} from "../common/buttons";
import {runOnContentChange} from "../common/autorun";

interface TransactionScrape {
    pageAccount: PageAccount;
    pageTransactions: TransactionStore[];
}

let pageAlreadyScraped = false;

async function doScrape(): Promise<TransactionScrape> {
    if (pageAlreadyScraped) {
        throw new Error("Already scraped. Stopping.");
    }
    const accounts = await chrome.runtime.sendMessage({
        action: "list_accounts",
    });
    const id = await getCurrentPageAccount(accounts);
    const txs = scrapeTransactionsFromPage(id.id);
    pageAlreadyScraped = true;
    if (txs.length === 0) {
        throw new Error("Page is not ready for scraping");
    }
    await chrome.runtime.sendMessage({
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
    const button = document.createElement("button");
    button.textContent = "Export Transactions"
    button.addEventListener("click", async () => doScrape(), false);

    button.classList.add('ui-action-button', 'btn-primary', 'btn', 'btn-default', 'btn-block');

    const outerContainer = document.createElement("div");
    outerContainer.classList.add('col-xs-12', 'col-sm-2', 'filter-cols')
    const innerContainer = document.createElement("div");
    innerContainer.classList.add('form-group', 'filter-icon-padding')
    outerContainer.append(innerContainer);
    innerContainer.append(button);

    setTimeout(() => {
        const [housing] = document.querySelectorAll("div.row.filter-cols");
        housing.append(outerContainer);
    }, 2000); // TODO: A smarter way of handling render delay
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
                }))
                .catch(err => {
                    console.log('Will try again on next draw', err)
                });
        }
    });
}

// If your manifest.json allows your content script to run on multiple pages,
// you can call this function more than once, or set the urlPath to "".
runOnURLMatch(
    'app/transactions',
    () => !!document.getElementById(buttonId),
    () => {
        pageAlreadyScraped = false;
        addButton();
    },
)

runOnContentChange(
    'app/transactions',
    enableAutoRun,
)
