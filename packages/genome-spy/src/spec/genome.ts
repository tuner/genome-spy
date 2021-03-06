export interface Contig {
    name: string;
    size: number;
}

export interface GenomeConfig {
    /**
     * Name of the genome assembly, e.g., `hg19` or `hg38`.
     */
    name: string;

    /**
     * Base url of data files: chromsizes, cytobands, and gene annotations.
     *
     * **Default:** https://genomespy.app/data/genomes/
     */
    baseUrl?: string;

    /**
     * As an alternative for chromSizes, the contigs can be provided inline.
     */
    contigs?: Contig[];
}
