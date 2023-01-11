import {TransactionStore, TransactionTypeProperty} from "firefly-iii-typescript-sdk-fetch";
import {parseDate} from "../common/dates";
import {AccountRead} from "firefly-iii-typescript-sdk-fetch/dist/models/AccountRead";
import {addButtonOnURLMatch} from "../common/buttons";

async function getCurrentPageAccountId(
    allAccounts: AccountRead[],
): Promise<string> {
    const backButton = document.getElementById('BackButton');
    const accountNum = backButton!.querySelector('span.card-last')!.textContent!.split('...')[1];
    const account = allAccounts.find(acct => acct.attributes.accountNumber === accountNum);
    console.log('account', account);
    return account!.id!;
}

async function scrapeTransactionsFromPage(
    accountNo: string,
): Promise<TransactionStore[]> {
    const container = document.querySelectorAll('div.list-container div.list-item').values();
    return Array.from(container).map(item => {
        const itemName = item.querySelector("div.item-name");
        const itemDesc = item.querySelector('span.item-bottom-left > div');
        const itemAmt = item.querySelector('div.text-right > div.item-amount');
        const itemDate = item.parentElement!.parentElement!.parentElement!.querySelector('div.list-floating-header');
        const amountStr = itemAmt!.textContent!.trim();
        const isDeposit = amountStr.startsWith('-');
        const tType = isDeposit ? TransactionTypeProperty.Deposit : TransactionTypeProperty.Withdrawal;
        const tDate = parseDate(itemDate!.textContent!);
        const tAmt = (isDeposit ? amountStr.replace("-", "") : amountStr).replace('$', '').replace(',', '');
        const tDesc = `${itemName!.textContent} - ${itemDesc!.textContent!}`;

        const sourceId = tType === TransactionTypeProperty.Withdrawal ? accountNo : undefined;
        const destId = tType === TransactionTypeProperty.Deposit ? accountNo : undefined;

        return {
            errorIfDuplicateHash: true,
            transactions: [{
                type: tType,
                date: tDate,
                amount: tAmt,
                description: tDesc,
                sourceId: sourceId,
                destinationId: destId,
            }],
        };
    }).map(tr => {
        tr.transactions = tr.transactions.filter(
            t => !t.description.includes("Pending")
        );
        return tr;
    });
}

const buttonId = 'firefly-iii-transactions-export-button'

addButtonOnURLMatch(
    '',
    () => !!document.getElementById(buttonId),
    () => {
    const button = document.createElement("button");
    button.textContent = "Export Transactions"
    button.addEventListener("click", async() => {
        console.log('clicked');
        const accounts = await chrome.runtime.sendMessage({
            action: "list_accounts",
        });
        console.log('accounts', accounts);
        const id = await getCurrentPageAccountId(accounts);
        console.log('id', id);
        const transactions = await scrapeTransactionsFromPage(id);
        console.log('tx', transactions);
        chrome.runtime.sendMessage(
            {
                action: "store_transactions",
                value: transactions,
            },
            () => {
            }
        );
    }, false);

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
});
