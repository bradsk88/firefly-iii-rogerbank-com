import {applyStylingAndAddButtonForLocalOnlyRow, applyStylingToFoundRow, buildRowForRemoteOnlyTx} from "./custom";
import {
    TransactionRead,
    TransactionSplitStore,
    TransactionStore,
    TransactionTypeProperty
} from "firefly-iii-typescript-sdk-fetch";

export interface MetaTx {
    tx: {
        destinationId: string | null;
        sourceId: string | null;
        type: TransactionTypeProperty;
        date: Date, description: string, amount: string, remoteId?: string,
    },
    txRow?: HTMLElement
    prevRow?: HTMLElement,
    nextRow?: HTMLElement,
}

export function createRowWithButtonForRemoteOnlyTx(
    tx: {
        date: Date, description: string, amount: string,
    },
    syncToRemote: () => void,
    defaultBgCss: string,
    prevRow?: HTMLElement,
    nextRow?: HTMLElement,
) {
    // This adds a new row element to indicate that the data was only found on
    // the remote server and is missing from the local page. It also adds a
    // button to delete the data to the remote server.
    const btnFn = (elementToRemoveOnSuccess: HTMLElement) => {
        const btn = document.createElement('button');
        btn.addEventListener('click', () => {
            syncToRemote();
            // BASE: Actually wait for success
            elementToRemoveOnSuccess.remove();
        });
        // BASE: Add the ability to "ignore" for transactions that are remote-only for a reason
        btn.innerText = 'Delete from Firefly III';
        return btn;
    }
    if (prevRow) {
        const el = buildRowForRemoteOnlyTx(defaultBgCss, tx, btnFn);
        prevRow?.parentElement?.insertBefore(el, prevRow);
    } else {
        const el = buildRowForRemoteOnlyTx(defaultBgCss, tx, btnFn);
        nextRow?.parentElement?.prepend(el);
    }
}

export class FireflyTransactionUIAdder {
    private synced: MetaTx[] = [];
    private remoteOnly: MetaTx[] = [];
    private localOnly: MetaTx[] = [];

    constructor(
        private readonly accountNo: string,
    ) {
    }

    registerSynced(tx: MetaTx): void {
        this.synced = [...this.synced, tx];
    }

    registerRemoteOnly(tx: MetaTx): void {
        this.remoteOnly = [...this.remoteOnly, tx];
    }

    registerLocalOnly(tx: MetaTx): void {
        this.localOnly = [...this.localOnly, tx];
    }

    registerDuplicates(metaTx: MetaTx, transactionSplits: TransactionRead[]) {
        let map = transactionSplits.map(
            v => ({
                ...metaTx, tx: {
                    ...v.attributes.transactions[0],
                    remoteId: v.id,
                }
            })
        );
        this.remoteOnly = [...this.remoteOnly, ...map];
    }

    processAll() {
        document.querySelectorAll(".added-by-firefly-iii-scan").forEach(v => v.remove());
        const param = {
            bgCssForRemoteOnly: 'rgba(255, 152, 0, 255)',
            bgCssForDuplicates: 'rgba(244, 67, 54, 255)',
        };
        this.synced.forEach(
            row => applyStylingToFoundRow(row.txRow!, 'rgba(230, 230, 255, 255)'),
        );
        this.localOnly.forEach(
            row => applyStylingAndAddButtonForLocalOnlyRow(
                row.txRow!, (e: MouseEvent) => {
                    this.storeTx(row);
                    e.preventDefault();
                }
            ),
        );
        this.remoteOnly.forEach(row => createRowWithButtonForRemoteOnlyTx(
                row.tx,
                () => this.deleteFromRemote(row.tx.remoteId!),
                'rgba(255, 220, 168, 255)',
                row.prevRow, row.nextRow
            ),
        )
    }

    private storeTx(row: MetaTx) {
        chrome.runtime.sendMessage({
                action: "store_transactions",
                is_auto_run: false,
                value: [{
                    applyRules: true,
                    errorIfDuplicateHash: false,
                    transactions: [{
                        amount: row.tx.amount,
                        description: row.tx.description,
                        date: row.tx.date,
                        type: row.tx.type,
                        sourceId: row.tx.sourceId,
                        destinationId: row.tx.destinationId,
                    } as TransactionSplitStore]
                } as TransactionStore],
            },
            () => {
            });
    }

    private deleteFromRemote(remoteId: string) {
        chrome.runtime.sendMessage({
            action: "delete_transaction",
            value: remoteId,
        }).catch(e => console.error("Failed to delete transaction", e));
    }
}
