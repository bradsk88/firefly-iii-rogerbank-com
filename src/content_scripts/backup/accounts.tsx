import {
    AccountRoleProperty,
    AccountStore,
    CreditCardType,
    ShortAccountTypeProperty
} from "firefly-iii-typescript-sdk-fetch";
import {priceFromString} from "../common/prices";
import {parseDate} from "../common/dates";
import {addButtonOnURLMatch} from "../common/buttons";

function scrapeAccountsFromPage(): AccountStore[] {
    const name = document.querySelector("div.banner-title > div.jsx-parser");
    const cards = Array.from(document.querySelectorAll('div.account-summary-tiles-custom-inner div.twocard-container').values());
    const statementBalanceCard = cards.filter(v => v.textContent!.includes("Statement Balance"))[0];
    const statementBalance = statementBalanceCard.querySelector("span.card-balance")!.textContent;
    const statementDateText = statementBalanceCard.querySelector('div.custom-card-text')!.textContent;
    const statementDate = parseDate(statementDateText!!.split('As of')[1].trim());
    return [
        {
            name: name!.textContent!,
            type: ShortAccountTypeProperty.Asset,
            accountRole: AccountRoleProperty.CcAsset,
            accountNumber: name!.textContent!.split('...')[1],
            openingBalance: `-${priceFromString(statementBalance!)}`,
            openingBalanceDate: statementDate,
            creditCardType: CreditCardType.MonthlyFull,
            monthlyPaymentDate: new Date(2023, 1, 1),
        }
    ];
}


const buttonId = 'firefly-iii-accounts-export-button'

addButtonOnURLMatch(
    '',
    () => !!document.getElementById(buttonId),
    () => {
    // TODO: Prompt for currency. Do all Rogers accounts use CAD?

    const button = document.createElement("button");
    button.id = buttonId;
    button.textContent = "Export Account"
    button.addEventListener("click", () => {
        const accounts = scrapeAccountsFromPage();

        console.log('sending accounts for storage', accounts);

        chrome.runtime.sendMessage(
            {
                action: "store_accounts",
                value: accounts,
            },
            () => {}
        );
    }, false);

    button.classList.add('btn-default', 'ui-dropdown-btn', 'dropdown-toggle', 'btn', 'btn-default');

    const container = document.createElement("div");
    container.classList.add('quick-link-options')
    container.append(button)
    container.style.border = 'none';
    container.style.textAlign = 'end';

    setTimeout(() => {
        const [housing] = document.querySelectorAll("div.banner-title");
        housing.append(container);
    }, 2000); // TODO: A smarter way of handling render delay
});
