import {
    AccountRoleProperty,
    TransactionRead,
    TransactionSplitStore,
    TransactionStore,
    TransactionTypeProperty
} from "firefly-iii-typescript-sdk-fetch";
import {AutoRunState} from "../background/auto_state";
import {
    getButtonDestination,
    getCurrentPageAccount,
    getRowAmount,
    getRowDate,
    getRowDesc,
    getRowElements,
    isPageReadyForScraping
} from "./scrape/transactions";
import {PageAccount} from "../common/accounts";
import {runOnURLMatch} from "../common/buttons";
import {runOnContentChange} from "../common/autorun";
import {AccountRead} from "firefly-iii-typescript-sdk-fetch/dist/models/AccountRead";
import {
    allowFuzzyDates,
    debugAutoRun,
    isSingleAccountBank,
    negativeMeansWithdrawal,
    transactionsPerPage
} from "../extensionid";
import {backToAccountsPage} from "./auto_run/transactions";
import {debugLog, showDebug} from "./auto_run/debug";
import {FireflyTransactionUIAdder, MetaTx} from "./scan/transactions";

interface TransactionScrape {
    pageAccount: PageAccount;
    pageTransactions: TransactionStore[];
}

let pageAlreadyScraped = false;

export interface TSWP {
    tx: TransactionStore,
    row: Element,
}

/**
 * @param pageAccount The Firefly III account for the current page
 */
export function scrapeTransactionsFromPage(
    pageAccount: AccountRead,
): TSWP[] {
    const rows = getRowElements();
    return rows.map((r, idx) => {
        let tType = TransactionTypeProperty.Deposit;
        let srcId: string | undefined = undefined;
        let destId: string | undefined = pageAccount.id;

        let returnVal;
        try {
            const amount = getRowAmount(r, pageAccount);
            if (amount < 0 && negativeMeansWithdrawal || amount > 0 && !negativeMeansWithdrawal) {
                tType = TransactionTypeProperty.Withdrawal;
                srcId = pageAccount.id;
                destId = undefined;
            }
            let newTX = {
                type: tType,
                date: getRowDate(r),
                amount: `${Math.abs(amount)}`,
                description: getRowDesc(r)?.trim(),
                destinationId: destId,
                sourceId: srcId
            };
            setTimeout(() => {
                showDebug(
                    "Scraped transactions, including row "
                    + idx + ":\n" + JSON.stringify(newTX, undefined, '\t')
                );
            })
            returnVal = {
                tx: {
                    errorIfDuplicateHash: true,
                    applyRules: true,
                    transactions: [newTX],
                },
                row: r,
            };
        } catch (e: any) {
            if (debugAutoRun) {
                setTimeout(() => {
                    showDebug(
                        "Tried to scrape transaction, but encountered error on row "
                        + idx + ":\n" + e.message,
                    );
                })
            }
            throw e;
        }
        return returnVal;
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
    const txs = scrapeTransactionsFromPage(acct);
    pageAlreadyScraped = true;
    const txOnly = txs.map(v => v.tx);
    if (!debugAutoRun) {
        await chrome.runtime.sendMessage({
                action: "store_transactions",
                is_auto_run: isAutoRun,
                value: txOnly,
            },
            () => {
            });
    }
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
        pageTransactions: txOnly,
    };
}

function isSame(remote: TransactionRead, scraped: TransactionSplitStore) {
    let tx = remote.attributes.transactions[0];
    if (tx.description.replace(/\s+/g, ' ') !== scraped.description.replace(/\s+/g, ' ')) {
        return false;
    }
    if (tx.type !== scraped.type) {
        return false;
    }
    let remoteAmt = remote.attributes.transactions.map(v => parseFloat(v.amount)).reduce((t, v) => t + v);
    let scrapedAmt = parseFloat(scraped.amount);
    if (remoteAmt === scrapedAmt && negativeMeansWithdrawal) {
        return false;
    }
    if (remoteAmt !== scrapedAmt && !negativeMeansWithdrawal) {
        return false;
    }
    let remoteDate = Date.parse(tx.date as any as string);
    let scrapedDate = Date.parse(scraped.date as any as string);
    if (remoteDate !== scrapedDate) {
        if (allowFuzzyDates) {
            return Math.abs(remoteDate - scrapedDate) < 24*60*60*1000;
        }
        return false;
    }
    return true;
}

async function doScan(): Promise<void> {
    const accounts = await chrome.runtime.sendMessage({
        action: "list_accounts",
    });
    const acct = await getCurrentPageAccount(accounts);
    const txs = scrapeTransactionsFromPage(acct);
    pageAlreadyScraped = true;
    let remoteTxs: TransactionRead[] = await chrome.runtime.sendMessage({
        action: "list_transactions",
        value: {accountId: acct.id, endDate: txs[0].tx.transactions[0].date, pageSize: transactionsPerPage},
    });
    if (txs.length > remoteTxs.length) {
        let remoteTxs2: TransactionRead[] = await chrome.runtime.sendMessage({
            action: "list_transactions",
            value: {accountId: acct.id, endDate: txs[Math.floor(txs.length/2)].tx.transactions[0].date, pageSize: transactionsPerPage},
        });
        remoteTxs = [...remoteTxs, ...remoteTxs2.filter(v => !remoteTxs.includes(v))];
    }
    if (txs.length > remoteTxs.length) {
        let remoteTxs2: TransactionRead[] = await chrome.runtime.sendMessage({
            action: "list_transactions",
            value: {accountId: acct.id, endDate: txs[Math.floor(txs.length/2)].tx.transactions[0].date, pageSize: transactionsPerPage},
        });
        remoteTxs = [...remoteTxs, ...remoteTxs2.filter(v => !remoteTxs.includes(v))];
    }
    const adder = new FireflyTransactionUIAdder(acct.id);
    for (let i = 0; i < txs.length; i++) {
        const v = txs[i];
        const scraped = v.tx.transactions[0];
        let metaTx = {
            tx: scraped,
            txRow: v.row as HTMLElement,
            prevRow: txs[i-1]?.row as HTMLElement,
            nextRow: txs[i+1]?.row as HTMLElement,
        } as MetaTx;
        let remoteMatches = remoteTxs.filter(remote => isSame(remote, scraped));
        if (remoteMatches.length > 1) {
            adder.registerDuplicates(metaTx, remoteMatches.slice(1));
        }
        if (remoteMatches.length >= 1) {
            adder.registerSynced(metaTx);
            remoteTxs = remoteTxs.filter(v => !remoteMatches.includes(v));
        } else {
            adder.registerLocalOnly(metaTx)
        }
    }
    remoteTxs
        .filter(v => new Date(v.attributes.transactions[0].date) > txs[txs.length - 1].tx.transactions[0].date)
        .map(v => {
            // TODO: Also factor in similarity of description (for the case where there are multiple Txs with the same date)
            let prevRow = Array.from(txs).reverse().find(x => new Date(x.tx.transactions[0].date) >= new Date(v.attributes.transactions[0].date));
            return ({
                tx: {...v.attributes.transactions[0], remoteId: v.id}, // BASE: add all sub transactions to remoteOnly
                prevRow: prevRow ? prevRow?.row as HTMLElement : undefined,
                nextRow: prevRow ? undefined : txs[0].row as HTMLElement,
            } as MetaTx);
        }).forEach(v => adder.registerRemoteOnly(v));
    adder.processAll();
}

const buttonId = 'firefly-iii-export-transactions-button';

function addButton() {
    const outerContainer = document.createElement("div");
    outerContainer.classList.add('col-xs-12', 'col-sm-2', 'filter-cols')
    const innerContainer = document.createElement("div");
    innerContainer.classList.add('form-group', 'filter-icon-padding')
    outerContainer.append(innerContainer);

    const button = document.createElement("button");
    button.id = buttonId;
    button.textContent = "Export Transactions"
    button.addEventListener("click", async () => doScrape(false), false);
    button.classList.add('ui-action-button', 'btn-primary', 'btn', 'btn-default', 'btn-block');
    innerContainer.append(button);

    const button2 = document.createElement("button");
    button2.id = buttonId + "2";
    button2.textContent = "Scan Transactions"
    button2.addEventListener("click", async () => doScan(), false);
    button.classList.add('ui-action-button', 'btn-primary', 'btn', 'btn-default', 'btn-block');
    innerContainer.append(button2);

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
    txPage,
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

chrome.runtime.onMessage.addListener((message) => {
    if (message.action !== "content.scan_transactions") {
        return false;
    }
    setTimeout(async () => doScan());
    return true;
})
