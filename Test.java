public class Test {
    public static void printArray(int[][] arr) {
        for (int i = 0; i < arr.length; i++) {
            for (int j = 0; j < arr[0].length; j++) {
                System.out.print(arr[i][j] + " ");
            }
            System.out.println();
        }
    }

    public static void rotate45(int[][] arr) {
        int row = arr.length; 
        int col = arr[0].length; 

        for(int i=0; i<row; i++) {
            for(int j=i+1; j<row; j++) {
                int temp = arr[i][j];
                arr[i][j] = arr[j][i];
                arr[j][i] = temp;
            }
        }
    }

    public static void main(String[] args) {
        int[][] arr = {
                { 1, 2, 3 },
                { 4, 5, 6 },
                { 7, 8, 9 }
        };

        System.out.println("BEFORE 45 degree rotation");
        printArray(arr);
        System.out.println();

        rotate45(arr);
        System.out.println("AFFTER 45 degr rotation");
        printArray(arr);

        rotate45(arr);
        System.out.println("AFFTER 45 degr rotation");
        printArray(arr);

    }
}
