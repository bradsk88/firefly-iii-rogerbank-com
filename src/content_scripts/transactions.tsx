import {TransactionStore, TransactionTypeProperty} from "firefly-iii-typescript-sdk-fetch";
import {AutoRunState} from "../background/auto_state";
import {
    getButtonDestination,
    getCurrentPageAccount,
    getRowAmount,
    getRowDate, getRowDesc,
    getRowElements, isPageReadyForScraping
} from "./scrape/transactions";
import {PageAccount} from "../common/accounts";
import {runOnURLMatch} from "../common/buttons";
import {runOnContentChange} from "../common/autorun";
import {AccountRead} from "firefly-iii-typescript-sdk-fetch/dist/models/AccountRead";
import {isSingleAccountBank} from "../extensionid";
import {backToAccountsPage} from "./auto_run/transactions";
import {debugLog} from "./auto_run/debug";

interface TransactionScrape {
    pageAccount: PageAccount;
    pageTransactions: TransactionStore[];
}

let pageAlreadyScraped = false;

/**
 * @param pageAccount The Firefly III account for the current page
 */
export function scrapeTransactionsFromPage(
    pageAccount: AccountRead,
): TransactionStore[] {
    const rows = getRowElements();
    return rows.map(r => {
        let tType = TransactionTypeProperty.Withdrawal;
        let srcId: string | undefined = pageAccount.id;
        let destId: string | undefined = undefined;

        const amount = getRowAmount(r, pageAccount);
        if (amount < 0) {
            tType = TransactionTypeProperty.Deposit;
            srcId = undefined;
            destId = pageAccount.id;
        }

        return {
            errorIfDuplicateHash: true,
            transactions: [{
                type: tType,
                date: getRowDate(r),
                amount: `${Math.abs(amount)}`,
                description: getRowDesc(r),
                destinationId: destId,
                sourceId: srcId
            }],
        };
    });
}

async function doScrape(isAutoRun: boolean): Promise<TransactionScrape> {
    if (isAutoRun && pageAlreadyScraped) {
        throw new Error("Already scraped. Stopping.");
    }

    const accounts = await chrome.runtime.sendMessage({
        action: "list_accounts",
    });
    const acct = await getCurrentPageAccount(accounts);
    const stxs = scrapeTransactionsFromPage(acct);
    pageAlreadyScraped = true;
    if (stxs.length === 0) {
        throw new Error("Page is not ready for scraping");
    }
    const txs = stxs.filter(
        r => !r.transactions[0].description.toLowerCase().includes("pending")
    )
    await chrome.runtime.sendMessage({
            action: "store_transactions",
            is_auto_run: isAutoRun,
            value: txs,
        },
        () => {
        });
    if (isSingleAccountBank) {
        await chrome.runtime.sendMessage({
            action: "complete_auto_run_state",
            state: AutoRunState.Transactions,
        });
    }
    return {
        pageAccount: {
            accountNumber: acct.attributes.accountNumber!,
            name: acct.attributes.name,
            id: acct.id,
        },
        pageTransactions: txs,
    };
}

const buttonId = 'firefly-iii-export-transactions-button';

function addButton() {
    const button = document.createElement("button");
    button.id = buttonId;
    button.textContent = "Export Transactions"
    button.addEventListener("click", async () => doScrape(false), false);

    button.classList.add('ui-action-button', 'btn-primary', 'btn', 'btn-default', 'btn-block');

    const outerContainer = document.createElement("div");
    outerContainer.classList.add('col-xs-12', 'col-sm-2', 'filter-cols')
    const innerContainer = document.createElement("div");
    innerContainer.classList.add('form-group', 'filter-icon-padding')
    outerContainer.append(innerContainer);
    innerContainer.append(button);

    setTimeout(() => {
        getButtonDestination().append(outerContainer);
    }, 2000); // TODO: A smarter way of handling render delay
}

function enableAutoRun() {
    if (!isPageReadyForScraping()) {
        debugLog("Page is not ready for scraping")
        return;
    }
    chrome.runtime.sendMessage({
        action: "get_auto_run_state",
    }).then(state => {
        debugLog("Got state", state)
        if (state === AutoRunState.Transactions) {
            doScrape(true)
                .then((id: TransactionScrape) => {
                    if (isSingleAccountBank) {
                        return chrome.runtime.sendMessage({
                            action: "complete_auto_run_state",
                            state: AutoRunState.Transactions,
                        })
                    } else {
                        return chrome.runtime.sendMessage({
                            action: "increment_auto_run_tx_account",
                            lastAccountNameCompleted: id.pageAccount.name,
                        }).then(() => backToAccountsPage())
                    }
                })
                .catch(err => {
                    console.log('Will try again on next draw', err)
                });
        }
    });
}

const txPage = 'app/transactions';

runOnURLMatch(txPage, () => pageAlreadyScraped = false);

// If your manifest.json allows your content script to run on multiple pages,
// you can call this function more than once, or set the urlPath to "".
runOnContentChange(
    'app/transactions',
    () => {
        if (!!document.getElementById(buttonId)) {
            return;
        }
        addButton();
    },
    getButtonDestination,
)


runOnContentChange(
    txPage,
    enableAutoRun,
    undefined,
    'txAutoRun',
);
