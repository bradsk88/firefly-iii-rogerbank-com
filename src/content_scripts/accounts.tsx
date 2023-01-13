import {
    AccountRoleProperty,
    AccountStore,
    ShortAccountTypeProperty
} from "firefly-iii-typescript-sdk-fetch/dist/models";
import {AutoRunState} from "../background/auto_state";
import {getAccountElements, getAccountName, getAccountNumber, getOpeningBalance} from "./scrape/accounts";
import {openAccountForAutoRun} from "./auto_run/accounts";
import {runOnContentChange, runOnURLMatch} from "../common/buttons";
import {CreditCardType} from "firefly-iii-typescript-sdk-fetch";

async function scrapeAccountsFromPage(): Promise<AccountStore[]> {
    const accounts = getAccountElements().map(element => {
        const accountNumber = getAccountNumber(element)
        const accountName = getAccountName(element);
        const openingBalance = getOpeningBalance(element);
        const as: AccountStore = {
            name: accountName,
            type: ShortAccountTypeProperty.Asset,
            accountRole: AccountRoleProperty.CcAsset,
            accountNumber: accountNumber,
            openingBalance: `-${openingBalance.balance}`,
            openingBalanceDate: openingBalance.date,
            creditCardType: CreditCardType.MonthlyFull,
            monthlyPaymentDate: new Date(2023, 1, 1),
        };
        return as;
    });
    chrome.runtime.sendMessage(
        {
            action: "store_accounts",
            value: accounts,
        },
        () => {
        }
    );
    return accounts;
}

const buttonId = 'firefly-iii-export-accounts-button';

function addButton() {
    const button = document.createElement("button");
    button.id = buttonId;
    button.textContent = "Export Accounts"
    button.addEventListener("click", () => scrapeAccountsFromPage(), false);
    document.body.append(button);
}

function enableAutoRun() {
    // This code is for executing the auto-run functionality for the hub extension
    // More Info: https://github.com/bradsk88/firefly-iii-chrome-extension-hub
    chrome.runtime.sendMessage({
        action: "get_auto_run_state",
    }).then(state => {
        if (state === AutoRunState.Accounts) {
            scrapeAccountsFromPage()
                .then(() => chrome.runtime.sendMessage({
                    action: "complete_auto_run_state",
                    state: AutoRunState.Accounts,
                }));
        } else if (state === AutoRunState.Transactions) {
            openAccountForAutoRun();
        }
    });
}

runOnURLMatch(
    '',
    () => !!document.getElementById(buttonId),
    addButton,
);

runOnContentChange(
    'app/accountSummary',
    enableAutoRun,
)