import {TransactionStore, TransactionTypeProperty} from "firefly-iii-typescript-sdk-fetch";
import {PageAccount} from "../../common/accounts";
import {AccountRead} from "firefly-iii-typescript-sdk-fetch/dist/models/AccountRead";
import {parseDate} from "../../common/dates";

/**
 * @param accounts The first page of account in your Firefly III instance
 */
export async function getCurrentPageAccount(
    accounts: AccountRead[],
): Promise<PageAccount> {
    const backButton = document.getElementById('BackButton');
    const accountNum = backButton!.querySelector('span.card-last')!.textContent!.split('...')[1];
    const account = accounts.find(acct => acct.attributes.accountNumber === accountNum)!;
    return {
        id: account.id,
        name: account.attributes.name,
        accountNumber: account.attributes.accountNumber || undefined,
    };
}

/**
 * @param pageAccountId The Firefly III account ID for the current page
 */
export function scrapeTransactionsFromPage(
    pageAccountId: string,
): TransactionStore[] {
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

        const sourceId = tType === TransactionTypeProperty.Withdrawal ? pageAccountId : undefined;
        const destId = tType === TransactionTypeProperty.Deposit ? pageAccountId : undefined;

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