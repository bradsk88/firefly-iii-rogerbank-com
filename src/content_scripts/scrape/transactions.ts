import {AccountRead} from "firefly-iii-typescript-sdk-fetch/dist/models/AccountRead";
import {parseDate} from "../../common/dates";
import {priceFromString} from "../../common/prices";

export function getButtonDestination(): Element {
    return document.querySelector("div.row.filter-cols")!;
}

/**
 * @param accounts The first page of account in your Firefly III instance
 */
export async function getCurrentPageAccount(
    accounts: AccountRead[],
): Promise<AccountRead> {
    const backButton = document.getElementById('BackButton');
    const accountNumber = backButton!.querySelector('span.card-last')!.textContent!.split('...')[1];
    return accounts.find(
        acct => acct.attributes.accountNumber === accountNumber,
    )!;
}

export function getRowElements(): Element[] {
    return Array.from(document.querySelectorAll(
        'div.list-container div.list-item'
    ).values());
}

export function getRowDate(el: Element): Date {
    const itemDate = el.parentElement!.parentElement!.parentElement!.querySelector('div.list-floating-header');
    return parseDate(itemDate!.textContent!);
}

function isRowLoading(r: Element): boolean {
    return false;
}

export function getRowAmount(r: Element): number {
    if (isRowLoading(r)) {
        throw new Error("Page is not ready for scraping")
    }
    const itemAmt = r.querySelector('div.text-right > div.item-amount');
    const amountStr = itemAmt!.textContent!.trim();
    return priceFromString(amountStr);
}

export function getRowDesc(r: Element): string {
    const itemName = r.querySelector("div.item-name");
    const itemDesc = r.querySelector('span.item-bottom-left > div');
    return `${itemName!.textContent} - ${itemDesc!.textContent!}`;
}

export function findBackToAccountsPageButton(): HTMLElement {
    // TODO: Once a single account's transactions have been scraped, we need to
    //  go back to the main accounts page to finish the auto run. Find an
    //  element on the page that we can click on to go back. Example below.
    return document.querySelector('button.btn-icon-back')!;
}