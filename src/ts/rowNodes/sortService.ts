import {RowNode} from "../entities/rowNode";
import {Column} from "../entities/column";
import {Autowired, Bean} from "../context/context";
import {SortController} from "../sortController";
import {_} from "../utils";
import {ValueService} from "../valueService";
import {GridOptionsWrapper} from "../gridOptionsWrapper";
import {GroupNameInfoParams, GroupValueService} from "../groupValueService";
import {AutoGroupColService} from "../columnController/autoGroupColService";

export interface SortOption {
    inverter: number,
    column: Column
}

export interface SortedRowNode {
    currentPos: number,
    rowNode: RowNode
}

@Bean('sortService')
export class SortService {
    @Autowired('sortController') private sortController: SortController;
    @Autowired('valueService') private valueService: ValueService;
    @Autowired('groupValueService') private groupValueService: GroupValueService;
    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;

    sortAccordingToColumnsState(rowNode: RowNode) {
        let sortOptions: SortOption[] = this.sortController.getSortForRowController();
        this.sort(rowNode, sortOptions);
    }

    sort(rowNode: RowNode, sortOptions: SortOption[]) {
        // sort any groups recursively
        rowNode.childrenAfterFilter.forEach(child => {
            if (child.group) {
                this.sort(child, sortOptions);
            }
        });

        rowNode.childrenAfterSort = rowNode.childrenAfterFilter.slice(0);

        let sortActive = _.exists(sortOptions) && sortOptions.length > 0;
        if (sortActive) {
            // RE https://ag-grid.atlassian.net/browse/AG-444
            //Javascript sort is non deterministic when all the array items are equals
            //ie Comparator always returns 0, so if you want to ensure the array keeps its
            //order, then you need to add an additional sorting condition manually, in this
            //case we are going to inspect the original array position
            let sortedRowNodes: SortedRowNode[] = rowNode.childrenAfterSort.map((it, pos) => {
                return {currentPos: pos, rowNode: it}
            });
            sortedRowNodes.sort(this.compareRowNodes.bind(this, sortOptions));
            rowNode.childrenAfterSort = sortedRowNodes.map(sorted => sorted.rowNode);
        }

        this.updateChildIndexes(rowNode);
    }


    private compareRowNodes(sortOptions: any, sortedNodeA: SortedRowNode, sortedNodeB: SortedRowNode) {
        let nodeA: RowNode = sortedNodeA.rowNode;
        let nodeB: RowNode = sortedNodeB.rowNode;

        // Iterate columns, return the first that doesn't match
        for (let i = 0, len = sortOptions.length; i < len; i++) {
            let sortOption = sortOptions[i];
            // let compared = compare(nodeA, nodeB, sortOption.column, sortOption.inverter === -1);

            let isInverted = sortOption.inverter === -1;
            let valueA: any = this.getValue(nodeA, sortOption.column);
            let valueB: any = this.getValue(nodeB, sortOption.column);
            let comparatorResult: number;
            if (sortOption.column.getColDef().comparator) {
                //if comparator provided, use it
                comparatorResult = sortOption.column.getColDef().comparator(valueA, valueB, nodeA, nodeB, isInverted);
            } else {
                //otherwise do our own comparison
                comparatorResult = _.defaultComparator(valueA, valueB, this.gridOptionsWrapper.isAccentedSort());
            }

            if (comparatorResult !== 0) {
                return comparatorResult * sortOption.inverter;
            }
        }
        // All matched, we make is so that the original sort order is kept:
        return sortedNodeA.currentPos - sortedNodeB.currentPos;
    }

    private getValue(nodeA: RowNode, column: Column): string {
        return this.valueService.getValue(column, nodeA);
    }

    private updateChildIndexes(rowNode: RowNode) {
        if (_.missing(rowNode.childrenAfterSort)) {
            return;
        }

        rowNode.childrenAfterSort.forEach((child: RowNode, index: number) => {
            child.setFirstChild(index === 0);
            child.setLastChild(index === rowNode.childrenAfterSort.length - 1);
            child.setChildIndex(index);
        });
    }
}