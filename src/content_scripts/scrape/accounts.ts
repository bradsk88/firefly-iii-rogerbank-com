import {priceFromString} from "../../common/prices";
import {OpeningBalance} from "../../background/firefly_export";
import {parseDate} from "../../common/dates";

export function getButtonDestination(): Element {
    return document.querySelector("div.banner-title")!;
}

export function getAccountElements(): Element[] {
    return [document.querySelector("div.banner-title > div.jsx-parser")!];
}

export function getAccountNumber(
    accountElement: Element,
): string {
    return getAccountName(accountElement).split('...')[1]
}

export function getAccountName(
    accountElement: Element,
): string {
    return accountElement.textContent!;
}

export function getOpeningBalance(
    accountElement: Element,
): OpeningBalance {
    const cards = Array.from(document.querySelectorAll('div.account-summary-tiles-custom-inner div.twocard-container').values());
    const statementBalanceCard = cards.filter(v => v.textContent!.includes("Statement Balance"))[0];
    const statementBalance = statementBalanceCard.querySelector("span.card-balance")!.textContent;
    const statementDateText = statementBalanceCard.querySelector('div.custom-card-text')!.textContent;
    const statementDate = parseDate(statementDateText!!.split('As of')[1].trim());
    return {
        balance: priceFromString(statementBalance!),
        date: statementDate,
        accountNumber: getAccountNumber(accountElement),
        accountName: getAccountName(accountElement),
    };
}